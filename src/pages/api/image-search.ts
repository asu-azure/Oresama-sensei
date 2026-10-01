// GET /api/image-search?q= — pictures for a flashcard. Pixabay first (needs
// PIXABAY_KEY), Openverse as the always-available fallback. No AI tokens.
import type { APIRoute } from "astro";
import { PIXABAY_KEY } from "astro:env/server";
import { authed, json } from "../../server/auth";
import type { WebHit } from "../../lib/images";

export const prerender = false;

const UA = { "User-Agent": "oresama-sensei/5.0" };

async function pixabay(q: string): Promise<WebHit[]> {
  if (!PIXABAY_KEY) return [];
  const u = new URL("https://pixabay.com/api/");
  u.search = new URLSearchParams({ key: PIXABAY_KEY, q, per_page: "12", safesearch: "true" }).toString();
  const res = await fetch(u, { headers: UA });
  if (!res.ok) throw new Error(`pixabay ${res.status}`);
  const j = (await res.json()) as {
    hits?: { id: number; tags?: string; pageURL?: string; webformatURL?: string; largeImageURL?: string; user?: string }[];
  };
  return (j.hits ?? [])
    .filter((h) => h.largeImageURL)
    .map((h) => ({
      id: String(h.id),
      title: h.tags ?? "",
      thumb: h.webformatURL ?? h.largeImageURL!,
      url: h.largeImageURL!,
      creator: h.user ?? "",
      license: "Pixabay License",
      landing: h.pageURL ?? "",
    }));
}

async function openverse(q: string): Promise<WebHit[]> {
  const u = new URL("https://api.openverse.org/v1/images/");
  u.search = new URLSearchParams({ q, page_size: "12", mature: "false", extension: "jpg,png,webp" }).toString();
  const res = await fetch(u, { headers: UA });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  const j = (await res.json()) as {
    results?: {
      id: string;
      title?: string;
      url?: string;
      thumbnail?: string;
      creator?: string;
      license?: string;
      license_version?: string;
      foreign_landing_url?: string;
    }[];
  };
  return (j.results ?? [])
    .filter((r) => r.url && r.thumbnail)
    .map((r) => ({
      id: r.id,
      title: r.title ?? "",
      thumb: r.thumbnail!,
      url: r.url!,
      creator: r.creator ?? "",
      license: [r.license, r.license_version].filter(Boolean).join(" ").toUpperCase(),
      landing: r.foreign_landing_url ?? "",
    }));
}

const PROVIDERS = [
  ["pixabay", pixabay],
  ["openverse", openverse],
] as const;

export const GET: APIRoute = async ({ request, url }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;
  const q = url.searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (!q) return json({ source: null, results: [] });
  for (const [name, fn] of PROVIDERS) {
    try {
      const results = await fn(q);
      if (results.length) return json({ source: name, results });
    } catch (e) {
      console.error(`image-search ${name} failed:`, e);
    }
  }
  return json({ source: null, results: [] });
};
