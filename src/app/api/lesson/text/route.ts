import { createClient } from "@/lib/supabase/server";
import { streamLesson, extractKnowledge, generateExercises } from "@/lib/claude";
import { recallKnowledge, storeKnowledge } from "@/lib/memory";
import { buildLessonSystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/types";

const MAX_CHARS = 4000;

/** Generate a lesson from typed text (a sentence or passage) — the photo->lesson
 *  pipeline without the OCR/image step. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { text?: string; deep?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const text = (body.text ?? "").trim();
  const deep = body.deep === true;
  if (!text) {
    return new Response("Please enter some Japanese text or a sentence.", {
      status: 400,
    });
  }
  if (text.length > MAX_CHARS) {
    return new Response(`Text too long (max ${MAX_CHARS} characters).`, {
      status: 413,
    });
  }

  const title = text.split("\n")[0].slice(0, 60) || "Text lesson";

  // Create the lesson row up front (no image; kind = "text").
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({ user_id: user.id, title, source_text: text, kind: "text" })
    .select("id")
    .single();
  if (lessonError || !lesson) {
    return new Response("Failed to create lesson", { status: 500 });
  }
  const lessonId = lesson.id;

  const [{ data: profile }, recalled] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, text.slice(0, 500), 8),
  ]);
  const system = buildLessonSystemPrompt(profile as Profile | null, recalled);
  const claudeStream = streamLesson(system, text, deep, "text");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let article = "";
      let clientGone = false;

      claudeStream.on("text", (delta) => {
        article += delta;
        if (!clientGone) {
          try {
            controller.enqueue(encoder.encode(delta));
          } catch {
            clientGone = true;
          }
        }
      });

      try {
        await claudeStream.finalMessage();
      } catch (e) {
        console.error("text lesson generation error:", e);
      }

      try {
        if (article.trim()) {
          await supabase
            .from("lessons")
            .update({ article_md: article })
            .eq("id", lessonId);
          const items = await extractKnowledge(article);
          if (items.length > 0) {
            await storeKnowledge(supabase, user.id, items, "lesson");
          }
        }
      } catch (e) {
        console.error("text lesson persistence failed:", e);
      }

      try {
        controller.close();
      } catch {
        // already closed/cancelled by the client
      }

      // Background: generate practice exercises (no timeout pressure on Render).
      try {
        if (article.trim()) {
          const exercises = await generateExercises({
            content: article,
            count: 6,
          });
          if (exercises.length > 0) {
            await supabase
              .from("lessons")
              .update({ exercises })
              .eq("id", lessonId);
          }
        }
      } catch (e) {
        console.error("exercise generation failed:", e);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-lesson-id": lessonId,
    },
  });
}