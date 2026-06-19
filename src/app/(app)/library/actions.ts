"use server";

import { createClient } from "@/lib/supabase/server";
import type { LibraryItem } from "./library-client";
import { LIBRARY_COLS } from "./columns";
import { generateDeepDive, resolveEngine, type DeepDiveExample } from "@/lib/claude";
import { recallKnowledge } from "@/lib/memory";
import type { Profile } from "@/lib/types";

const DAY_MS = 86_400_000;

/** Cached "deep dive" for a saved item — generates + caches on first request
 *  (or when `force`). Degrades gracefully if migration 0008 isn't run yet. */
export async function getOrGenerateExplanation(
  itemId: string,
  force = false,
): Promise<
  | { explanation_md: string; examples: DeepDiveExample[] }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!force) {
    const { data: cached } = await supabase
      .from("knowledge_explanations")
      .select("explanation_md,examples")
      .eq("user_id", user.id)
      .eq("knowledge_item_id", itemId)
      .maybeSingle();
    if (cached?.explanation_md) {
      return {
        explanation_md: cached.explanation_md,
        examples: (cached.examples ?? []) as DeepDiveExample[],
      };
    }
  }

  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,example,jlpt_level,notes")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const [{ data: profile }, recalledRaw] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, `${item.term} ${item.meaning ?? ""}`, 4),
  ]);
  const recalled = recalledRaw
    .filter((r) => r.id !== itemId)
    .slice(0, 3)
    .map((r) => ({ term: r.term, reading: r.reading, meaning: r.meaning }));

  let result: { explanation: string; examples: DeepDiveExample[] };
  try {
    result = await generateDeepDive({
      item,
      profile: profile as Profile | null,
      recalled,
      engine: resolveEngine(
        (profile as { ai_engine?: string } | null)?.ai_engine,
      ),
    });
  } catch (e) {
    console.error("deep dive generation failed:", e);
    return { error: "Couldn't generate an explanation right now." };
  }
  if (!result.explanation) {
    return { error: "Couldn't generate an explanation right now." };
  }

  const { error } = await supabase.from("knowledge_explanations").upsert(
    {
      user_id: user.id,
      knowledge_item_id: itemId,
      explanation_md: result.explanation,
      examples: result.examples,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,knowledge_item_id" },
  );
  if (error) console.error("explanation upsert failed:", error.message);

  return { explanation_md: result.explanation, examples: result.examples };
}

/** Sign each storage path into a small TRANSFORMED thumbnail (fast to load) plus
 *  the FULL original (used by the lightbox and as an onError fallback when the
 *  project doesn't have Storage image transforms enabled). */
async function signThumbs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
): Promise<{ thumb: string; full: string }[]> {
  const out = await Promise.all(
    paths.map(async (p) => {
      const bucket = supabase.storage.from("lesson-images");
      const [{ data: t }, { data: f }] = await Promise.all([
        bucket.createSignedUrl(p, 3600, {
          transform: { width: 1280, quality: 50, resize: "contain" },
        }),
        bucket.createSignedUrl(p, 3600),
      ]);
      const thumb = t?.signedUrl ?? f?.signedUrl ?? "";
      const full = f?.signedUrl ?? t?.signedUrl ?? "";
      return { thumb, full };
    }),
  );
  return out.filter((x) => x.thumb);
}

/** Read a lesson's stored page image paths (RLS-scoped to the user). */
async function lessonImagePaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  lessonId: string,
): Promise<string[]> {
  const { data: lesson } = await supabase
    .from("lessons")
    .select("image_path,image_paths")
    .eq("id", lessonId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!lesson) return [];
  return lesson.image_paths && lesson.image_paths.length > 0
    ? lesson.image_paths
    : lesson.image_path
      ? [lesson.image_path]
      : [];
}

/** Thumbnail + full URLs for a lesson's source page image(s), for the on-demand
 *  preview next to a saved item. Fetched lazily (only when a preview opens) so
 *  the lists don't sign hundreds of URLs up front. */
export async function getLessonImageUrls(
  lessonId: string,
): Promise<{ thumb: string; full: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const paths = await lessonImagePaths(supabase, user.id, lessonId);
  return paths.length ? signThumbs(supabase, paths) : [];
}

/** Image(s) to preview for ONE book page: its own page photo when it has one,
 *  otherwise every page image from its lesson (so a single upload tagged across
 *  a page range still shows a picture on every page in that range). */
export async function getBookPageImages(
  lessonId: string | null,
  ownPath: string | null,
): Promise<{ thumb: string; full: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // A page's own image (paths are stored under the user's folder; ignore anything
  // that isn't, so a client can't ask us to sign someone else's object).
  if (ownPath && ownPath.startsWith(`${user.id}/`)) {
    return signThumbs(supabase, [ownPath]);
  }
  if (!lessonId) return [];
  const paths = await lessonImagePaths(supabase, user.id, lessonId);
  return paths.length ? signThumbs(supabase, paths) : [];
}

/** Next page of items, newest first, for infinite scroll. `hasMore` is true
 *  when a full page came back (so there is likely another page). */
export async function loadMoreItems(
  offset: number,
  limit: number,
): Promise<{ items: LibraryItem[]; hasMore: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], hasMore: false };

  const { data } = await supabase
    .from("knowledge_items")
    .select(LIBRARY_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const items = (data ?? []) as unknown as LibraryItem[];
  return { items, hasMore: items.length === limit };
}

/** All items added on a single calendar day (UTC), newest first. A day is
 *  small, so no pagination is needed. `dayKey` is "YYYY-MM-DD". */
export async function loadItemsForDay(dayKey: string): Promise<LibraryItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const start = `${dayKey}T00:00:00.000Z`;
  const end = new Date(Date.parse(start) + DAY_MS).toISOString();

  const { data } = await supabase
    .from("knowledge_items")
    .select(LIBRARY_COLS)
    .eq("user_id", user.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as LibraryItem[];
}
