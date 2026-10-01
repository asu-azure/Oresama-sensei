// Pictures on knowledge items. Everything happens in the browser under RLS:
// the bucket policy only lets a user touch objects under `<uid>/…`.
//
// Uploads are re-encoded to ≤1280 px WebP first (JPEG where the browser can't
// encode WebP — Safari), so a 4 MB phone photo lands as ~150 KB. That is also
// why no Storage image transform is needed to show them.

import { sb, api } from "./supabase";

export const BUCKET = "lesson-images";
const MAX_SIDE = 1280;
const SIGN_TTL = 2 * 60 * 60; // seconds; a review session lasts well under this

/** Signed URLs for many paths in one request. Missing/failed paths are absent. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await sb().storage.from(BUCKET).createSignedUrls(unique, SIGN_TTL);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

let webpOk: boolean | null = null;
function canWebp(): boolean {
  if (webpOk === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpOk = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpOk;
}

/** Downscale + re-encode any image blob for storage. */
export async function encodeForUpload(blob: Blob): Promise<{ blob: Blob; ext: string; type: string }> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs would turn black as JPEG
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const type = canWebp() ? "image/webp" : "image/jpeg";
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.82));
  if (!out) throw new Error("Couldn't encode the image.");
  return { blob: out, ext: type === "image/webp" ? "webp" : "jpg", type };
}

/** Store `blob` as the item's picture, replacing (and deleting) any old one.
 *  Returns the new path and a signed URL. */
export async function setItemImage(
  userId: string,
  itemId: string,
  oldPath: string | null,
  blob: Blob,
  source: string | null,
): Promise<{ path: string; url: string }> {
  const enc = await encodeForUpload(blob);
  const path = `${userId}/items/${crypto.randomUUID()}.${enc.ext}`;
  const bucket = sb().storage.from(BUCKET);
  const up = await bucket.upload(path, enc.blob, {
    contentType: enc.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (up.error) throw new Error("Upload failed.");
  const { error } = await sb()
    .from("knowledge_items")
    .update({ image_path: path, image_source: source?.trim().slice(0, 500) || null })
    .eq("id", itemId);
  if (error) {
    await bucket.remove([path]).catch(() => {});
    throw new Error("Couldn't save the picture.");
  }
  if (oldPath) await bucket.remove([oldPath]).catch(() => {});
  const urls = await signPaths([path]);
  return { path, url: urls[path] ?? "" };
}

export async function removeItemImage(itemId: string, path: string | null): Promise<void> {
  const { error } = await sb()
    .from("knowledge_items")
    .update({ image_path: null, image_source: null })
    .eq("id", itemId);
  if (error) throw new Error("Couldn't remove the picture.");
  if (path) await sb().storage.from(BUCKET).remove([path]).catch(() => {});
}

export type WebHit = {
  id: string;
  title: string;
  thumb: string;
  url: string;
  creator: string;
  license: string;
  landing: string;
};

export async function searchWebImages(q: string): Promise<{ source: string | null; results: WebHit[] }> {
  const r = await api(`/api/image-search?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error("Search failed.");
  return r.json();
}

/** A web pick's bytes, fetched through our proxy (the hosts don't send CORS). */
export async function fetchWebImage(url: string): Promise<Blob> {
  const r = await api(`/api/image-fetch?url=${encodeURIComponent(url)}`);
  if (!r.ok) throw new Error((await r.text()) || "Couldn't fetch that image.");
  return r.blob();
}

export function creditFor(h: WebHit): string {
  return [h.title || "Image", h.creator && `by ${h.creator}`, h.license && `(${h.license})`, h.landing]
    .filter(Boolean)
    .join(" ");
}
