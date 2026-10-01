// GET /api/image-fetch?url= — the bytes of a picked web image, so the browser
// can re-encode and upload it itself (the image hosts don't send CORS headers).
// Signed-in users only, https only, images only, 8 MB max, no private hosts.
import type { APIRoute } from "astro";
import { authed } from "../../server/auth";

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** Literal loopback / private / link-local hosts. Names are resolved by the
 *  platform, which has nothing internal worth reaching, so this is the cheap
 *  belt to that braces. */
function privateHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".internal") ||
    /^(127|10|0)\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "::1" ||
    /^f[cd][0-9a-f]{2}:/.test(h) ||
    /^fe80:/.test(h)
  );
}

export const GET: APIRoute = async ({ request, url }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;

  let target: URL;
  try {
    target = new URL(url.searchParams.get("url") ?? "");
  } catch {
    return new Response("Bad image address.", { status: 400 });
  }
  if (target.protocol !== "https:" || privateHost(target.hostname)) {
    return new Response("That address isn't allowed.", { status: 400 });
  }

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "oresama-sensei/5.0" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return new Response("Couldn't fetch that image.", { status: 502 });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!TYPES.has(type)) return new Response("That isn't a picture.", { status: 415 });
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return new Response("Image too large (max 8 MB).", { status: 413 });
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new Response("Image too large (max 8 MB).", { status: 413 });
    return new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "no-store" } });
  } catch {
    return new Response("Couldn't fetch that image.", { status: 502 });
  }
};
