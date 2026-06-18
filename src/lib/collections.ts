import type { SupabaseClient } from "@supabase/supabase-js";
import type { Collection } from "@/lib/types";
import type { CollectionKind } from "@/lib/source";

/** Lightweight shape for pickers (uploader, backfill editor). */
export type CollectionOption = {
  id: string;
  kind: string;
  title: string;
  total_pages: number | null;
};

/** List the user's collections (newest first) for selection menus. */
export async function listUserCollections(
  supabase: SupabaseClient,
  userId: string,
): Promise<CollectionOption[]> {
  const { data } = await supabase
    .from("collections")
    .select("id,kind,title,total_pages")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CollectionOption[];
}

/** Resolve a collection for an upload: use an existing id, or create one from a
 *  title (deduping case-insensitively against the same kind). Returns the
 *  collection id, or null when no collection applies. */
export async function findOrCreateCollection(
  supabase: SupabaseClient,
  userId: string,
  params: {
    collectionId?: string | null;
    title?: string | null;
    kind?: CollectionKind | null;
    author?: string | null;
    coverPath?: string | null;
  },
): Promise<string | null> {
  if (params.collectionId) return params.collectionId;
  const title = (params.title ?? "").trim();
  const kind = params.kind ?? "book";
  if (!title) return null;

  // Reuse an existing same-kind collection with the same title (case-insensitive).
  const { data: existing } = await supabase
    .from("collections")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", kind)
    .ilike("title", title)
    .maybeSingle();
  if (existing?.id) {
    // Opportunistically attach a cover if the existing one lacks it.
    if (params.coverPath) {
      await supabase
        .from("collections")
        .update({ cover_path: params.coverPath })
        .eq("id", existing.id)
        .is("cover_path", null);
    }
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from("collections")
    .insert({
      user_id: userId,
      kind,
      title,
      author: params.author?.trim() || null,
      cover_path: params.coverPath ?? null,
    })
    .select("id")
    .single();
  if (error || !created) {
    console.error("findOrCreateCollection insert failed:", error?.message);
    return null;
  }
  return created.id;
}

/** Record the pages an upload covers for a collection (book/game/series), so the
 *  books page grid can show what's been uploaded and link each page to its
 *  lesson. Pages run pageStart..pageEnd (inclusive); when only a start is given,
 *  it's a single page. Image paths (in upload order) are attached per page. */
export async function upsertCollectionPages(
  supabase: SupabaseClient,
  userId: string,
  params: {
    collectionId: string;
    lessonId: string;
    pageStart: number | null;
    pageEnd: number | null;
    imagePaths: string[];
  },
): Promise<void> {
  if (params.pageStart == null) return;
  const end = params.pageEnd ?? params.pageStart;
  const start = params.pageStart;
  if (end < start || end - start > 100) return; // guard against typos
  const rows = [];
  for (let p = start; p <= end; p++) {
    rows.push({
      user_id: userId,
      collection_id: params.collectionId,
      page_number: p,
      status: "content",
      lesson_id: params.lessonId,
      image_path: params.imagePaths[p - start] ?? null,
    });
  }
  const { error } = await supabase
    .from("collection_pages")
    .upsert(rows, { onConflict: "user_id,collection_id,page_number" });
  if (error) console.error("upsertCollectionPages failed:", error.message);
}

/** Fetch one collection (RLS scopes to the user). */
export async function getCollection(
  supabase: SupabaseClient,
  id: string,
): Promise<Collection | null> {
  const { data } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Collection | null) ?? null;
}
