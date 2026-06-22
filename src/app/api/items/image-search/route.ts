import { createClient } from "@/lib/supabase/server";

/** Normalized image-search hit (uniform across providers). */
type Hit = {
  id: string;
  title: string;
  thumb: string;
  url: string;
  creator: string;
  license: string;
  landing: string;
  attribution: string;
};

const UA = { "User-Agent": "oresama-sensei/1.0" };

/** Pixabay (free, license-clean). Needs PIXABAY_KEY. Returns [] if not set. */
async function searchPixabay(q: string): Promise<Hit[]> {
  const key = process.env.PIXABAY_KEY;
  if (!key) return [];
  const u = new URL("https://pixabay.com/api/");
  u.searchParams.set("key", key);
  u.searchParams.set("q", q);
  u.searchParams.set("per_page", "12");
  u.searchParams.set("safesearch", "true");
  u.searchParams.set("image_type", "all");
  const res = await fetch(u, { headers: UA });
  if (!res.ok) throw new Error(`pixabay ${res.status}`);
  const j = (await res.json()) as {
    hits?: Array<{
      id: number;
      tags?: string;
      pageURL?: string;
      previewURL?: string;
      webformatURL?: string;
      largeImageURL?: string;
      user?: string;
    }>;
  };
  return (j.hits ?? [])
    .filter((h) => h.largeImageURL)
    .map((h) => ({
      id: String(h.id),
      title: h.tags ?? "",
      thumb: h.webformatURL ?? h.previewURL ?? h.largeImageURL!,
      url: h.largeImageURL!,
      creator: h.user ?? "",
      license: "Pixabay License",
      landing: h.pageURL ?? "",
      attribution: "",
    }));
}

/** Openverse (free CC-licensed, no key). The always-available final fallback. */
async function searchOpenverse(q: string): Promise<Hit[]> {
  const api = new URL("https://api.openverse.org/v1/images/");
  api.searchParams.set("q", q);
  api.searchParams.set("page_size", "12");
  api.searchParams.set("mature", "false");
  api.searchParams.set("extension", "jpg,png,webp");
  const res = await fetch(api, { headers: UA });
  if (!res.ok) throw new Error(`openverse ${res.status}`);
  const j = (await res.json()) as {
    results?: Array<{
      id: string;
      title?: string;
      url?: string;
      thumbnail?: string;
      creator?: string;
      license?: string;
      license_version?: string;
      attribution?: string;
      foreign_landing_url?: string;
    }>;
  };
  return (j.results ?? [])
    .filter((r) => r.url && r.thumbnail)
    .map((r) => ({
      id: r.id,
      title: r.title ?? "",
      thumb: r.thumbnail!,
      url: r.url!,
      creator: r.creator ?? "",
      license: [r.license, r.license_version]
        .filter(Boolean)
        .join(" ")
        .toUpperCase(),
      landing: r.foreign_landing_url ?? "",
      attribution: r.attribution ?? "",
    }));
}

// Try in order; the first provider that returns results wins. A provider that
// isn't configured returns [] (skipped); one that errors throws and we fall
// through to the next. (Google Programmable Search was dropped — Google
// deprecated whole-web search engines, so it can only search fixed sites now.)
const PROVIDERS: ReadonlyArray<readonly [string, (q: string) => Promise<Hit[]>]> =
  [
    ["pixabay", searchPixabay],
    ["openverse", searchOpenverse],
  ];

/** Server-side multi-source image search (Pixabay → Openverse). Keeps the calls
 *  server-only (no CORS, keys hidden) and returns a uniform shape + the `source`
 *  that produced the results. No AI tokens are used. The picked image is later
 *  downloaded into our bucket by setItemImageFromUrl. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ source: null, results: [] });

  for (const [name, fn] of PROVIDERS) {
    try {
      const results = await fn(q);
      if (results.length > 0) return Response.json({ source: name, results });
    } catch (e) {
      console.error(`image-search ${name} failed:`, e);
      // fall through to the next provider
    }
  }
  return Response.json({ source: null, results: [] });
}
