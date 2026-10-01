// POST /api/words — quick-add, step 2: save the (possibly edited) card.
// Server-side only because the embedding needs the Gemini key.
import type { APIRoute } from "astro";
import { authed, json, readJson } from "../../server/auth";
import { saveItem } from "../../server/items";
import type { DraftItem } from "../../lib/types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;

  const body = await readJson<{ item?: Partial<DraftItem> }>(request);
  if (!body?.item?.term?.trim()) return json({ error: "A card needs a term." }, 400);
  try {
    const res = await saveItem(a.db, a.user.id, body.item, { source: "manual", source_type: "manual" });
    if (!res) return json({ error: "A card needs a term." }, 400);
    return json(res);
  } catch (e) {
    console.error("save failed:", e);
    return json({ error: "Couldn't save — try again." }, 500);
  }
};
