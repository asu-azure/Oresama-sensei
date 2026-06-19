import { createClient } from "@/lib/supabase/server";
import { ocrImage, runGeminiLessonStream } from "@/lib/gemini";
import {
  runClaudeLessonStream,
  lessonUserMessage,
  extractKnowledge,
  generateExercises,
  ocrImageWithClaude,
  resolveEngine,
  type LessonModelChoice,
} from "@/lib/claude";
import { recallKnowledge, storeKnowledge } from "@/lib/memory";
import { buildLessonSystemPrompt } from "@/lib/prompts";
import {
  findOrCreateCollection,
  upsertCollectionPages,
} from "@/lib/collections";
import {
  sourceTypeForMaterial,
  collectionKindForMaterial,
  type MaterialType,
} from "@/lib/source";
import type { Profile } from "@/lib/types";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image
const MAX_IMAGES = 6;
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type OcrModel = "auto" | "gemini" | "claude";

function parseIntOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseInt(String(v ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
  // Legacy "deep" flag maps to Opus; new "lessonModel" supersedes it.
  const deep = form.get("deep") === "true";
  const lessonModel = ((form.get("lessonModel") as LessonModelChoice) ||
    (deep ? "opus" : "claude")) as LessonModelChoice;
  const ocrModel = (form.get("ocrModel") as OcrModel) || "auto";

  // Source attribution (where this material came from).
  const materialType = ((form.get("materialType") as MaterialType) ||
    "textbook") as MaterialType;
  const sourceType = sourceTypeForMaterial(materialType);
  const collectionKind = collectionKindForMaterial(materialType);
  const existingCollectionId =
    (form.get("collectionId") as string)?.trim() || null;
  const newCollectionTitle = (form.get("collectionTitle") as string)?.trim() || null;
  const newCollectionAuthor = (form.get("collectionAuthor") as string)?.trim() || null;
  const coverFile = form.get("cover");
  const pageStart = parseIntOrNull(form.get("pageStart"));
  const pageEnd = parseIntOrNull(form.get("pageEnd"));

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
  let pages: string[] = [];
  try {
    pages = await Promise.all(
      buffers.map((buf, i) => runOcr(buf.toString("base64"), files[i].type, ocrModel)),
    );
    pageText = pages
      .map((t, i) =>
        files.length > 1
          ? `<page n="${i + 1}">\n${t.trim()}\n</page>`
          : t.trim(),
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

  // Store EVERY page image (private, scoped to the user's folder), in order.
  const imagePaths = (
    await Promise.all(
      files.map(async (f, i) => {
        const path = `${user.id}/${crypto.randomUUID()}.${EXT[f.type]}`;
        const { error } = await supabase.storage
          .from("lesson-images")
          .upload(path, buffers[i], { contentType: f.type, upsert: false });
        if (error) {
          console.error("image upload failed:", error.message);
          return null;
        }
        return path;
      }),
    )
  ).filter((p): p is string => p !== null);

  // Resolve the collection (book/game/series), uploading a cover if provided.
  let collectionId: string | null = null;
  if (collectionKind) {
    let coverPath: string | null = null;
    if (coverFile instanceof File && coverFile.size > 0 && EXT[coverFile.type]) {
      coverPath = `${user.id}/covers/${crypto.randomUUID()}.${EXT[coverFile.type]}`;
      const buf = Buffer.from(await coverFile.arrayBuffer());
      const { error: coverErr } = await supabase.storage
        .from("lesson-images")
        .upload(coverPath, buf, { contentType: coverFile.type, upsert: false });
      if (coverErr) {
        console.error("cover upload failed:", coverErr.message);
        coverPath = null;
      }
    }
    collectionId = await findOrCreateCollection(supabase, user.id, {
      collectionId: existingCollectionId,
      title: newCollectionTitle,
      kind: collectionKind,
      author: newCollectionAuthor,
      coverPath,
    });
  }

  const title =
    pages[0]?.trim().split("\n")[0]?.slice(0, 60) ||
    pageText.split("\n")[0].slice(0, 60) ||
    "Untitled lesson";

  // 3. Create the lesson row up front so we have an id to return.
  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      title,
      image_path: imagePaths[0] ?? null,
      image_paths: imagePaths.length > 0 ? imagePaths : null,
      source_text: pageText,
      material_type: materialType,
      collection_id: collectionId,
      page_start: pageStart,
      page_end: pageEnd,
    })
    .select("id")
    .single();
  if (lessonError || !lesson) {
    return new Response("Failed to create lesson", { status: 500 });
  }
  const lessonId = lesson.id;

  // Record the pages this upload covers (for the books page grid).
  if (collectionId && pageStart != null) {
    await upsertCollectionPages(supabase, user.id, {
      collectionId,
      lessonId,
      pageStart,
      pageEnd,
      imagePaths,
    });
  }

  // 4. Build context and stream the generated lesson. Sample the recall query
  //    across ALL pages (not just the first ~500 chars) so memory recall isn't
  //    biased toward page 1 on a multi-page upload.
  const recallQuery = pages.length
    ? pages.map((t) => t.trim().slice(0, 200)).join("\n").slice(0, 1000)
    : pageText.slice(0, 500);
  const [{ data: profile }, recalled] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, recallQuery, 8),
  ]);
  // The lesson writer uses the per-upload picker; extraction + exercises follow
  // the global engine setting.
  const engine = resolveEngine(
    (profile as { ai_engine?: string } | null)?.ai_engine,
  );
  const pageCount = files.length;
  const system = buildLessonSystemPrompt(
    profile as Profile | null,
    recalled,
    pageCount,
  );
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let article = "";
      let clientGone = false;

      // Stream deltas to the browser, but keep generating even if it leaves.
      const onDelta = (delta: string) => {
        if (!clientGone) {
          try {
            controller.enqueue(encoder.encode(delta));
          } catch {
            clientGone = true;
          }
        }
      };

      try {
        if (lessonModel === "gemini" || lessonModel === "gemini-pro") {
          article = await runGeminiLessonStream({
            system,
            userMessage: lessonUserMessage(pageText, "photo"),
            model: lessonModel,
            onDelta,
          });
        } else {
          article = await runClaudeLessonStream({
            system,
            pageText,
            source: "photo",
            pageCount,
            opus: lessonModel === "opus",
            onDelta,
          });
        }
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
          const items = await extractKnowledge(article, engine);
          if (items.length > 0) {
            await storeKnowledge(supabase, user.id, items, {
              source: "lesson",
              source_type: sourceType,
              collection_id: collectionId,
              lesson_id: lessonId,
            });
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
          const exercises = await generateExercises(
            {
              content: article,
              count: Math.min(6 + (pageCount - 1) * 2, 14),
            },
            engine,
          );
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
