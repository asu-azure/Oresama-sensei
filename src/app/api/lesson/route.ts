import { createClient } from "@/lib/supabase/server";
import { ocrImage } from "@/lib/gemini";
import {
  streamLesson,
  extractKnowledge,
  generateExercises,
  ocrImageWithClaude,
} from "@/lib/claude";
import { recallKnowledge, storeKnowledge } from "@/lib/memory";
import { buildLessonSystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/types";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image
const MAX_IMAGES = 6;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type OcrModel = "auto" | "gemini" | "claude";

/** True when a Gemini error looks transient/overloaded — worth a Claude fallback. */
function isBusy(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(
    msg,
  );
}

/** Read one image with the chosen provider. `auto`/`gemini` try Gemini first and
 *  fall back to Claude when Gemini is overloaded; `claude` forces Claude (with a
 *  Gemini fallback on error). */
async function runOcr(
  base64: string,
  mime: string,
  model: OcrModel,
): Promise<string> {
  if (model === "claude") {
    try {
      return await ocrImageWithClaude(base64, mime);
    } catch (e) {
      console.warn("Claude OCR failed, falling back to Gemini:", e);
      return ocrImage(base64, mime);
    }
  }
  try {
    return await ocrImage(base64, mime);
  } catch (e) {
    if (model === "auto" && isBusy(e)) {
      console.warn("Gemini busy — falling back to Claude OCR.");
      return ocrImageWithClaude(base64, mime);
    }
    throw e;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const form = await request.formData();
  const deep = form.get("deep") === "true";
  const ocrModel = (form.get("ocrModel") as OcrModel) || "auto";

  // Accept one or many images (`images` from the multi-picker; `image` legacy).
  const raw = form.getAll("images");
  const files = (raw.length ? raw : [form.get("image")]).filter(
    (f): f is File => f instanceof File,
  );

  if (files.length === 0) {
    return new Response("No image provided", { status: 400 });
  }
  if (files.length > MAX_IMAGES) {
    return new Response(`Too many images (max ${MAX_IMAGES})`, { status: 413 });
  }
  for (const f of files) {
    if (!EXT[f.type]) {
      return new Response("Unsupported image type (use PNG, JPG, or WebP)", {
        status: 415,
      });
    }
    if (f.size > MAX_BYTES) {
      return new Response("An image is too large (max 12 MB each)", {
        status: 413,
      });
    }
  }

  // Read every page, in order, and stitch them into one source text.
  const buffers = await Promise.all(
    files.map(async (f) => Buffer.from(await f.arrayBuffer())),
  );

  let pageText: string;
  try {
    const pages = await Promise.all(
      buffers.map((buf, i) => runOcr(buf.toString("base64"), files[i].type, ocrModel)),
    );
    pageText = pages
      .map((t, i) =>
        files.length > 1 ? `--- Page ${i + 1} ---\n${t.trim()}` : t.trim(),
      )
      .join("\n\n")
      .trim();
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

  // Store the first image (private, scoped to the user's folder).
  const first = files[0];
  const path = `${user.id}/${crypto.randomUUID()}.${EXT[first.type]}`;
  const { error: uploadError } = await supabase.storage
    .from("lesson-images")
    .upload(path, buffers[0], { contentType: first.type, upsert: false });
  if (uploadError) console.error("image upload failed:", uploadError.message);

  const title =
    pageText.replace(/^--- Page \d+ ---\n/, "").split("\n")[0].slice(0, 60) ||
    "Untitled lesson";

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

      // Background: generate practice exercises now that the client already has
      // the lesson. Safe on an always-on host (no per-request timeout).
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
