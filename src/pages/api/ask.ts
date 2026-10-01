// POST /api/ask — Ask Sensei. Streams plain text.
import type { APIRoute } from "astro";
import { authed, readJson } from "../../server/auth";
import { stream } from "../../server/gemini";
import { discussSystemPrompt } from "../../server/prompts";
import type { AskContext, ChatTurn } from "../../lib/types";

export const prerender = false;

const MAX_TURNS = 20;

export const POST: APIRoute = async ({ request }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;

  const body = await readJson<{ context?: AskContext; messages?: ChatTurn[] }>(request);
  const messages = (body?.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return new Response("Bad request", { status: 400 });
  }
  const system = discussSystemPrompt(body?.context ?? { kind: "free" });

  const enc = new TextEncoder();
  const out = new ReadableStream({
    async start(controller) {
      let gone = false;
      try {
        await stream({
          system,
          messages,
          onDelta: (t) => {
            if (gone) return;
            try {
              controller.enqueue(enc.encode(t));
            } catch {
              gone = true; // the client went away
            }
          },
        });
      } catch (e) {
        console.error("ask failed:", e);
        if (!gone) controller.enqueue(enc.encode("\n\n_(Sensei couldn't answer just now — try again.)_"));
      }
      try {
        controller.close();
      } catch {}
    },
  });
  return new Response(out, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
};
