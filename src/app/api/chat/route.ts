import { createClient } from "@/lib/supabase/server";
import {
  runChatStream,
  resolveChatModel,
  extractKnowledge,
  type ChatTurn,
} from "@/lib/claude";
import { recallKnowledge, storeKnowledge, storeMessage } from "@/lib/memory";
import { buildChatSystemPrompt } from "@/lib/prompts";
import { computeInsights, statsDigest, type InsightItem } from "@/lib/insights";
import type { Profile } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { conversationId?: string; message?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return new Response("Empty message", { status: 400 });

  // Ensure a conversation exists and belongs to this user.
  let conversationId = body.conversationId;
  if (conversationId) {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!data) conversationId = undefined;
  }
  if (!conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (error || !data) {
      return new Response("Failed to create conversation", { status: 500 });
    }
    conversationId = data.id;
  }
  if (!conversationId) {
    return new Response("Failed to resolve conversation", { status: 500 });
  }

  // Persist the user's message (with embedding) before answering.
  await storeMessage(supabase, {
    conversationId,
    userId: user.id,
    role: "user",
    content: message,
  });

  // Load context: profile, recalled knowledge, recent turns, and a live
  // progress snapshot (plain SQL — no embeddings, no LLM) so Sensei knows the
  // learner's current strengths/weaknesses.
  const [{ data: profile }, recalled, { data: history }, { data: allItems }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      recallKnowledge(supabase, message, 8),
      supabase
        .from("messages")
        .select("role,content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(20),
      supabase
        .from("knowledge_items")
        .select(
          "type,jlpt_level,term,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval,srs_due,created_at",
        )
        .eq("user_id", user.id),
    ]);

  const digest = statsDigest(
    computeInsights((allItems ?? []) as InsightItem[]),
  );
  const system = buildChatSystemPrompt(
    profile as Profile | null,
    recalled,
    digest,
  );
  const turns: ChatTurn[] = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Per-request model from the header dropdown, falling back to the saved
  // default (profiles.chat_model), then Gemini Flash. Degrades gracefully if
  // migration 0018 hasn't run (column absent → default).
  const model = resolveChatModel(
    body.model ?? (profile as { chat_model?: string } | null)?.chat_model,
  );
  const encoder = new TextEncoder();
  const convId: string = conversationId!; // guaranteed set above

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let clientGone = false;

      try {
        answer = await runChatStream({
          system,
          messages: turns,
          model,
          onDelta: (delta) => {
            if (!clientGone) {
              try {
                controller.enqueue(encoder.encode(delta));
              } catch {
                clientGone = true;
              }
            }
          },
        });
      } catch (e) {
        console.error("chat generation error:", e);
      }

      // Persist regardless of whether the client is still connected.
      try {
        if (answer.trim()) {
          await storeMessage(supabase, {
            conversationId: convId,
            userId: user.id,
            role: "assistant",
            content: answer,
          });
          const items = await extractKnowledge(
            `User asked: ${message}\n\nTutor answered:\n${answer}`,
          );
          if (items.length > 0) {
            await storeKnowledge(supabase, user.id, items, {
              source: "chat",
              source_type: "chat",
            });
          }
        }
      } catch (e) {
        console.error("chat persistence failed:", e);
      }

      try {
        controller.close();
      } catch {
        // already closed/cancelled by the client
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-conversation-id": convId,
    },
  });
}
