import { createClient } from "@/lib/supabase/server";
import { streamDiscuss, type ChatTurn } from "@/lib/claude";
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
  const claudeStream = streamDiscuss(system, body.messages);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      claudeStream.on("text", (delta) => {
        controller.enqueue(encoder.encode(delta));
      });
      await claudeStream.finalMessage();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
