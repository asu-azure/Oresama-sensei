"use server";

import { createClient } from "@/lib/supabase/server";

const BUCKET = "lesson-images";
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export type ItemImageUrls = { thumb: string; full: string; source: string | null };
type Result = ItemImageUrls | { error: string };

/** Sign a storage path into a transformed thumbnail + the full original. Mirrors
 *  `signThumbs` in library/actions.ts. */
async function sign(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<{ thumb: string; full: string }> {
  const bucket = supabase.storage.from(BUCKET);
  const [{ data: t }, { data: f }] = await Promise.all([
    bucket.createSignedUrl(path, 3600, {
      transform: { width: 1280, quality: 50, resize: "contain" },
    }),
    bucket.createSignedUrl(path, 3600),
  ]);
  const thumb = t?.signedUrl ?? f?.signedUrl ?? "";
  const full = f?.signedUrl ?? t?.signedUrl ?? "";
  return { thumb, full };
}

/** Best-effort removal of the item's current stored image object. */
async function removeOld(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string,
) {
  const { data } = await supabase
    .from("knowledge_items")
    .select("image_path")
    .eq("id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  const old = (data as { image_path?: string | null } | null)?.image_path;
  if (old) {
    await supabase.storage.from(BUCKET).remove([old]).catch(() => {});
  }
}

/** Store an uploaded image (photo or drawing PNG) as this item's picture. */
export async function uploadItemImage(
  itemId: string,
  formData: FormData,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No image provided." };
  const ext = EXT[file.type];
  if (!ext) return { error: "Use a PNG, JPG, or WebP image." };
  if (file.size > MAX_BYTES) return { error: "Image too large (max 8 MB)." };

  const path = `${user.id}/items/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type, upsert: false });
  if (upErr) return { error: "Upload failed." };

  await removeOld(supabase, user.id, itemId);
  const { error } = await supabase
    .from("knowledge_items")
    .update({ image_path: path, image_source: null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { error: "Couldn't save the image." };
  }
  return { ...(await sign(supabase, path)), source: null };
}

/** Download a remote image (a web-search pick) into our private bucket and set it
 *  as this item's picture, with an attribution credit. */
export async function setItemImageFromUrl(
  itemId: string,
  srcUrl: string,
  credit: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  let buf: Buffer;
  let contentType: string;
  try {
    const res = await fetch(srcUrl, {
      headers: { "User-Agent": "oresama-sensei/1.0" },
    });
    if (!res.ok) return { error: "Couldn't fetch that image." };
    contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!EXT[contentType]) return { error: "Unsupported image type." };
    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_BYTES) return { error: "Image too large (max 8 MB)." };
    buf = Buffer.from(ab);
  } catch {
    return { error: "Couldn't fetch that image." };
  }

  const path = `${user.id}/items/${crypto.randomUUID()}.${EXT[contentType]}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buf, { contentType, upsert: false });
  if (upErr) return { error: "Upload failed." };

  await removeOld(supabase, user.id, itemId);
  const source = credit.trim().slice(0, 500) || null;
  const { error } = await supabase
    .from("knowledge_items")
    .update({ image_path: path, image_source: source })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { error: "Couldn't save the image." };
  }
  return { ...(await sign(supabase, path)), source };
}

/** Remove this item's image (object + columns). */
export async function removeItemImage(
  itemId: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  await removeOld(supabase, user.id, itemId);
  const { error } = await supabase
    .from("knowledge_items")
    .update({ image_path: null, image_source: null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  return { ok: !error };
}

/** Signed URLs for an item's stored image path (lazy load in the library). */
export async function getItemImageUrls(
  path: string,
): Promise<{ thumb: string; full: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const urls = await sign(supabase, path);
  return urls.thumb ? urls : null;
}
