import { createClient } from "@/lib/supabase/server";

/** Server-side proxy for Openverse image search (free, CC-licensed, no API key).
 *  Keeps the call server-only (no CORS) and returns a trimmed, safe shape. The
 *  picked image is later downloaded into our bucket by setItemImageFromUrl. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ results: [] });

  const api = new URL("https://api.openverse.org/v1/images/");
  api.searchParams.set("q", q);
  api.searchParams.set("page_size", "12");
  api.searchParams.set("mature", "false");
  // Only formats we can re-store.
  api.searchParams.set("extension", "jpg,png,webp");

  try {
    const res = await fetch(api, {
      headers: { "User-Agent": "oresama-sensei/1.0" },
    });
    if (!res.ok) return Response.json({ results: [] });
    const json = (await res.json()) as {
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
    const results = (json.results ?? [])
      .filter((r) => r.url && r.thumbnail)
      .map((r) => ({
        id: r.id,
        title: r.title ?? "",
        thumb: r.thumbnail!,
        url: r.url!,
        creator: r.creator ?? "",
        license: [r.license, r.license_version].filter(Boolean).join(" ").toUpperCase(),
        landing: r.foreign_landing_url ?? "",
        attribution: r.attribution ?? "",
      }));
    return Response.json({ results });
  } catch {
    return Response.json({ results: [] });
  }
}
