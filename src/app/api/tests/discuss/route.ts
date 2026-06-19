import { createClient } from "@/lib/supabase/server";
import { runDiscussStream, type ChatTurn } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";
import { buildDiscussSystemPrompt } from "@/lib/prompts";
import type { AskContext, Exercise } from "@/lib/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Accepts the new generalized { context } shape, or legacy { exercise }.
  let body: {
    context?: AskContext;
    exercise?: Exercise;
    messages?: ChatTurn[];
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!body.messages?.length) {
    return new Response("Bad request", { status: 400 });
  }
  const context: AskContext =
    body.context ??
    (body.exercise
      ? { kind: "exercise", exercise: body.exercise }
      : { kind: "free" });

  const system = buildDiscussSystemPrompt(context);
  const engine = await getAiEngine(supabase, user.id);
  const messages = body.messages;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let gone = false;
      const onDelta = (delta: string) => {
        if (gone) return;
        try {
          controller.enqueue(encoder.encode(delta));
        } catch {
          gone = true;
        }
      };
      try {
        await runDiscussStream({ system, messages, engine, onDelta });
      } catch (e) {
        console.error("discuss generation error:", e);
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
