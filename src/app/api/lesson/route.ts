import { createClient } from "@/lib/supabase/server";
import { ocrImage } from "@/lib/gemini";
import { streamLesson, extractKnowledge } from "@/lib/claude";
import { recallKnowledge, storeKnowledge } from "@/lib/memory";
import { buildLessonSystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/types";

// 60s is the max on Vercel's Hobby (free) plan. Raise to 300 if you upgrade to Pro.
export const maxDuration = 60;

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const file = form.get("image");
  const deep = form.get("deep") === "true";

  if (!(file instanceof File)) {
    return new Response("No image provided", { status: 400 });
  }
  if (!EXT[file.type]) {
    return new Response("Unsupported image type (use PNG, JPG, or WebP)", {
      status: 415,
    });
  }
  if (file.size > MAX_BYTES) {
    return new Response("Image too large (max 12 MB)", { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  // 1. Read the page with Gemini vision.
  let pageText: string;
  try {
    pageText = await ocrImage(base64, file.type);
  } catch (e) {
    console.error("OCR failed:", e);
    return new Response(
      "The reading service is busy right now. Please try again in a moment.",
      { status: 503 },
    );
  }
  if (!pageText || pageText.includes("NO_TEXT_FOUND")) {
    return new Response(
      "Couldn't find readable Japanese text in that image.",
      { status: 422 },
    );
  }

  // 2. Store the original image (private, scoped to the user's folder).
  const path = `${user.id}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const { error: uploadError } = await supabase.storage
    .from("lesson-images")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) console.error("image upload failed:", uploadError.message);

  const title = pageText.split("\n")[0].slice(0, 60) || "Untitled lesson";

  // 3. Create the lesson row up front so we have an id to return.
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      title,
      image_path: uploadError ? null : path,
      source_text: pageText,
    })
    .select("id")
    .single();
  if (lessonError || !lesson) {
    return new Response("Failed to create lesson", { status: 500 });
  }
  const lessonId = lesson.id;

  // 4. Build context and stream the generated lesson.
  const [{ data: profile }, recalled] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, pageText.slice(0, 500), 8),
  ]);
  const system = buildLessonSystemPrompt(profile as Profile | null, recalled);
  const claudeStream = streamLesson(system, pageText, deep);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let article = "";
      let clientGone = false;

      // Stream deltas to the browser, but keep generating even if it leaves.
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
        console.error("lesson generation error:", e);
      }

      // Persist regardless of whether the client is still connected — this is
      // what was being skipped before when a tab switch aborted the stream.
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
        console.error("lesson persistence failed:", e);
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
      "x-lesson-id": lessonId,
    },
  });
}
