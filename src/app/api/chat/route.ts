import { createClient } from "@/lib/supabase/server";
import { streamChat, extractKnowledge, type ChatTurn } from "@/lib/claude";
import { recallKnowledge, storeKnowledge, storeMessage } from "@/lib/memory";
import { buildChatSystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { conversationId?: string; message?: string };
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

  // Load context: profile, recalled knowledge, recent conversation turns.
  const [{ data: profile }, recalled, { data: history }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, message, 8),
    supabase
      .from("messages")
      .select("role,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const system = buildChatSystemPrompt(profile as Profile | null, recalled);
  const turns: ChatTurn[] = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const claudeStream = streamChat(system, turns);
  const encoder = new TextEncoder();
  const convId: string = conversationId!; // guaranteed set above

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        claudeStream.on("text", (delta) => {
          controller.enqueue(encoder.encode(delta));
        });
        const final = await claudeStream.finalMessage();
        const answer = final.content
          .filter((b) => b.type === "text")
          .map((b) => (b.type === "text" ? b.text : ""))
          .join("");

        controller.close();

        // Persist the answer + extract knowledge after the client has the text.
        try {
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
            await storeKnowledge(supabase, user.id, items, "chat");
          }
        } catch (e) {
          console.error("chat persistence failed:", e);
        }
      } catch (e) {
        console.error("chat stream error:", e);
        controller.error(e);
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
