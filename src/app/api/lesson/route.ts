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

  // The uploader now sends JSON with images ALREADY uploaded to Storage
  // (bypassing the serverless body-size limit that broke multi-page uploads).
  // We still support the legacy multipart/form-data path for safety.
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  let lessonModel: LessonModelChoice;
  let ocrModel: OcrModel;
  let materialType: MaterialType;
  let existingCollectionId: string | null;
  let newCollectionTitle: string | null;
  let newCollectionAuthor: string | null;
  let pageStart: number | null;
  let pageEnd: number | null;
  let chapter: string | null;
  let chapterPage: number | null;
  // "extend": append into an existing lesson on the same page instead of
  // creating a new one (the uploader asks the user on a duplicate page).
  let mode: "extend" | "new";
  let extendLessonId: string | null;
  // Per-page buffers + mimes (for OCR) and the final stored paths.
  let buffers: Buffer[] = [];
  let mimes: string[] = [];
  let imagePaths: string[] = [];
  // Cover: already-uploaded path (JSON) or a file to upload server-side (legacy).
  let providedCoverPath: string | null = null;
  let coverFile: File | null = null;

  if (isJson) {
    const json = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!json) return new Response("Invalid request body", { status: 400 });

    const deep = json.deep === true || json.deep === "true";
    lessonModel = ((json.lessonModel as LessonModelChoice) ||
      (deep ? "opus" : "claude")) as LessonModelChoice;
    ocrModel = (json.ocrModel as OcrModel) || "auto";
    materialType = ((json.materialType as MaterialType) ||
      "textbook") as MaterialType;
    existingCollectionId = (json.collectionId as string)?.trim?.() || null;
    newCollectionTitle = (json.collectionTitle as string)?.trim?.() || null;
    newCollectionAuthor = (json.collectionAuthor as string)?.trim?.() || null;
    providedCoverPath = (json.coverPath as string)?.trim?.() || null;
    pageStart = parseIntOrNull(String(json.pageStart ?? ""));
    pageEnd = parseIntOrNull(String(json.pageEnd ?? ""));
    chapter = (json.chapter as string)?.trim?.() || null;
    chapterPage = parseIntOrNull(String(json.chapterPage ?? ""));
    mode = json.mode === "extend" ? "extend" : "new";
    extendLessonId = (json.extendLessonId as string)?.trim?.() || null;

    const paths = Array.isArray(json.imagePaths)
      ? (json.imagePaths as unknown[]).filter(
          (p): p is string => typeof p === "string" && p.length > 0,
        )
      : [];
    const mimeTypes = Array.isArray(json.mimeTypes)
      ? (json.mimeTypes as unknown[]).map((m) => String(m))
      : [];
    if (paths.length === 0) {
      return new Response("No image provided", { status: 400 });
    }
    if (paths.length > MAX_IMAGES) {
      return new Response(`Too many images (max ${MAX_IMAGES})`, { status: 413 });
    }
    // Only the user's own folder — RLS enforces this too, but fail fast.
    if (paths.some((p) => !p.startsWith(`${user.id}/`))) {
      return new Response("Forbidden image path", { status: 403 });
    }
    // Pull each page back from Storage for OCR.
    try {
      buffers = await Promise.all(
        paths.map(async (p) => {
          const { data, error } = await supabase.storage
            .from("lesson-images")
            .download(p);
          if (error || !data) throw new Error(error?.message ?? "download failed");
          return Buffer.from(await data.arrayBuffer());
        }),
      );
    } catch (e) {
      console.error("image download failed:", e);
      return new Response("Couldn't read the uploaded images.", { status: 400 });
    }
    mimes = paths.map((p, i) => {
      const ext = p.split(".").pop()?.toLowerCase();
      return (
        mimeTypes[i] ||
        (ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg")
      );
    });
    imagePaths = paths;
  } else {
    const form = await request.formData();
    const deep = form.get("deep") === "true";
    lessonModel = ((form.get("lessonModel") as LessonModelChoice) ||
      (deep ? "opus" : "claude")) as LessonModelChoice;
    ocrModel = (form.get("ocrModel") as OcrModel) || "auto";
    materialType = ((form.get("materialType") as MaterialType) ||
      "textbook") as MaterialType;
    existingCollectionId = (form.get("collectionId") as string)?.trim() || null;
    newCollectionTitle = (form.get("collectionTitle") as string)?.trim() || null;
    newCollectionAuthor = (form.get("collectionAuthor") as string)?.trim() || null;
    const cf = form.get("cover");
    coverFile = cf instanceof File ? cf : null;
    pageStart = parseIntOrNull(form.get("pageStart"));
    pageEnd = parseIntOrNull(form.get("pageEnd"));
    chapter = (form.get("chapter") as string)?.trim() || null;
    chapterPage = parseIntOrNull(form.get("chapterPage"));
    mode = form.get("mode") === "extend" ? "extend" : "new";
    extendLessonId = (form.get("extendLessonId") as string)?.trim() || null;

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
    buffers = await Promise.all(
      files.map(async (f) => Buffer.from(await f.arrayBuffer())),
    );
    mimes = files.map((f) => f.type);
    // Store every page image (private, scoped to the user's folder), in order.
    imagePaths = (
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
  }

  const sourceType = sourceTypeForMaterial(materialType);
  const collectionKind = collectionKindForMaterial(materialType);

  // Read every page, in order, and stitch them into one source text.
  let pageText: string;
  let pages: string[] = [];
  try {
    pages = await Promise.all(
      buffers.map((buf, i) => runOcr(buf.toString("base64"), mimes[i], ocrModel)),
    );
    pageText = pages
      .map((t, i) =>
        buffers.length > 1
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

  // Resolve the collection (book/game/series). The cover is either an
  // already-uploaded path (JSON) or a file to upload now (legacy form).
  let collectionId: string | null = null;
  if (collectionKind) {
    let coverPath: string | null = providedCoverPath;
    if (
      !coverPath &&
      coverFile instanceof File &&
      coverFile.size > 0 &&
      EXT[coverFile.type]
    ) {
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

  // 3. Either EXTEND an existing lesson on this page (append) or create a new
  //    one. When extending, we keep the prior content to merge in at persist time.
  type ExistingLesson = {
    article_md: string | null;
    image_paths: string[] | null;
    source_text: string | null;
    exercises: unknown[] | null;
  };
  let extending: ExistingLesson | null = null;
  let lessonId = "";

  if (mode === "extend" && extendLessonId) {
    const { data: ex } = await supabase
      .from("lessons")
      .select("id,article_md,image_paths,source_text,exercises")
      .eq("id", extendLessonId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ex?.id) {
      lessonId = ex.id as string;
      extending = {
        article_md: (ex.article_md as string | null) ?? null,
        image_paths: (ex.image_paths as string[] | null) ?? null,
        source_text: (ex.source_text as string | null) ?? null,
        exercises: (ex.exercises as unknown[] | null) ?? null,
      };
      // Best-effort: stamp a chapter onto the existing lesson if one was given.
      if (chapter != null || chapterPage != null) {
        await supabase
          .from("lessons")
          .update({ chapter, chapter_page: chapterPage })
          .eq("id", lessonId)
          .then(undefined, () => undefined);
      }
    }
  }

  if (!extending) {
    // Create the lesson row up front so we have an id to return. chapter columns
    // are best-effort (migration 0023): retry without them if the write fails.
    const baseInsert = {
      user_id: user.id,
      title,
      image_path: imagePaths[0] ?? null,
      image_paths: imagePaths.length > 0 ? imagePaths : null,
      source_text: pageText,
      material_type: materialType,
      collection_id: collectionId,
      page_start: pageStart,
      page_end: pageEnd,
    };
    let inserted = await supabase
      .from("lessons")
      .insert({ ...baseInsert, chapter, chapter_page: chapterPage })
      .select("id")
      .single();
    if (inserted.error) {
      inserted = await supabase
        .from("lessons")
        .insert(baseInsert)
        .select("id")
        .single();
    }
    if (inserted.error || !inserted.data) {
      return new Response("Failed to create lesson", { status: 500 });
    }
    lessonId = inserted.data.id;
  }

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
  const pageCount = buffers.length;
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
          // When extending, APPEND the new article/images/source to the existing
          // lesson instead of overwriting it.
          if (extending) {
            const dateLabel = new Date().toISOString().slice(0, 10);
            const finalArticle = extending.article_md
              ? `${extending.article_md}\n\n---\n\n## 追加 (added ${dateLabel})\n\n${article}`
              : article;
            const mergedImages = Array.from(
              new Set([...(extending.image_paths ?? []), ...imagePaths]),
            );
            const finalSource = extending.source_text
              ? `${extending.source_text}\n\n${pageText}`
              : pageText;
            await supabase
              .from("lessons")
              .update({
                article_md: finalArticle,
                image_path: mergedImages[0] ?? null,
                image_paths: mergedImages.length > 0 ? mergedImages : null,
                source_text: finalSource,
              })
              .eq("id", lessonId);
          } else {
            await supabase
              .from("lessons")
              .update({ article_md: article })
              .eq("id", lessonId);
          }
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
            // Extend mode appends to the existing set so older practice survives.
            const merged = extending
              ? [...(extending.exercises ?? []), ...exercises]
              : exercises;
            await supabase
              .from("lessons")
              .update({ exercises: merged })
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
