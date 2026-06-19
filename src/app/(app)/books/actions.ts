"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateCollectionSummary, resolveEngine } from "@/lib/claude";
import type { CollectionKind } from "@/lib/source";
import type { Profile } from "@/lib/types";

const COVER_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const COLLECTION_KINDS: CollectionKind[] = ["book", "series", "game", "other"];

/** Create a new collection (book/game/series) directly from the Books page,
 *  with an optional cover image. Returns the new id, or an error. */
export async function createCollection(
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Please enter a title." };
  const kindRaw = String(formData.get("kind") ?? "book") as CollectionKind;
  const kind = COLLECTION_KINDS.includes(kindRaw) ? kindRaw : "book";
  const author = String(formData.get("author") ?? "").trim() || null;
  const totalRaw = parseInt(String(formData.get("totalPages") ?? ""), 10);
  const totalPages = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null;

  // Optional cover upload (private bucket, under the user's covers/ folder).
  let coverPath: string | null = null;
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0 && COVER_EXT[cover.type]) {
    const path = `${user.id}/covers/${crypto.randomUUID()}.${COVER_EXT[cover.type]}`;
    const buf = Buffer.from(await cover.arrayBuffer());
    const { error: coverErr } = await supabase.storage
      .from("lesson-images")
      .upload(path, buf, { contentType: cover.type, upsert: false });
    if (coverErr) console.error("cover upload failed:", coverErr.message);
    else coverPath = path;
  }

  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: user.id,
      kind,
      title,
      author,
      total_pages: totalPages,
      cover_path: coverPath,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "Couldn't create the collection." };

  revalidatePath("/books");
  return { id: data.id };
}

/** Set/clear the total page count for a collection. */
export async function updateCollectionPages(
  collectionId: string,
  totalPages: number | null,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("collections")
    .update({ total_pages: totalPages && totalPages > 0 ? totalPages : null })
    .eq("id", collectionId)
    .eq("user_id", user.id);
  revalidatePath(`/books/${collectionId}`);
  return { ok: !error };
}

/** Mark a single page's status (content / cover / index / skip). Upserts the
 *  row so a page can be flagged even if it was never uploaded as a lesson. */
export async function setPageStatus(
  collectionId: string,
  pageNumber: number,
  status: "content" | "cover" | "index" | "skip",
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase.from("collection_pages").upsert(
    {
      user_id: user.id,
      collection_id: collectionId,
      page_number: pageNumber,
      status,
    },
    { onConflict: "user_id,collection_id,page_number" },
  );
  revalidatePath(`/books/${collectionId}`);
  return { ok: !error };
}

/** Generate (and cache) a brief AI summary of a collection. Pass force=true to
 *  regenerate. Returns the markdown, or an error message. */
export async function generateSummary(
  collectionId: string,
  force = false,
): Promise<{ summary_md: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: coll } = await supabase
    .from("collections")
    .select("id,title,kind,summary_md")
    .eq("id", collectionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!coll) return { error: "Collection not found." };
  if (!force && coll.summary_md) return { summary_md: coll.summary_md };

  // Build a compact digest from the collection's lessons + saved knowledge.
  const [{ data: lessons }, { data: items }, { data: profile }] =
    await Promise.all([
      supabase
        .from("lessons")
        .select("title,page_start,page_end")
        .eq("user_id", user.id)
        .eq("collection_id", collectionId)
        .order("page_start", { ascending: true })
        .limit(40),
      supabase
        .from("knowledge_items")
        .select("type,term,reading,meaning,jlpt_level")
        .eq("user_id", user.id)
        .eq("collection_id", collectionId)
        .limit(80),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    ]);

  const lessonLines = (lessons ?? [])
    .map((l) => {
      const pg =
        l.page_start != null
          ? ` (p.${l.page_start}${l.page_end && l.page_end !== l.page_start ? `–${l.page_end}` : ""})`
          : "";
      return `- ${l.title ?? "Untitled"}${pg}`;
    })
    .join("\n");
  const itemLines = (items ?? [])
    .map((it) => {
      const bits = [`[${it.type}]`, it.term];
      if (it.reading) bits.push(`(${it.reading})`);
      if (it.meaning) bits.push(`— ${it.meaning}`);
      if (it.jlpt_level) bits.push(`[${it.jlpt_level}]`);
      return `- ${bits.join(" ")}`;
    })
    .join("\n");

  if (!lessonLines && !itemLines) {
    return { error: "Nothing saved from this collection yet." };
  }

  const digest = `Lessons:\n${lessonLines || "(none)"}\n\nSaved vocabulary/grammar:\n${itemLines || "(none)"}`;

  let summary = "";
  try {
    summary = await generateCollectionSummary({
      title: coll.title,
      kind: coll.kind,
      digest,
      profile: profile as Profile | null,
      engine: resolveEngine(
        (profile as { ai_engine?: string } | null)?.ai_engine,
      ),
    });
  } catch (e) {
    console.error("collection summary failed:", e);
    return { error: "Couldn't generate a summary right now." };
  }
  if (!summary) return { error: "Couldn't generate a summary right now." };

  await supabase
    .from("collections")
    .update({
      summary_md: summary,
      summary_generated_at: new Date().toISOString(),
    })
    .eq("id", collectionId)
    .eq("user_id", user.id);

  revalidatePath(`/books/${collectionId}`);
  return { summary_md: summary };
}
