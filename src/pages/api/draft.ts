// POST /api/draft — quick-add, step 1: turn whatever the learner typed into a
// filled-in card for them to check. Writes nothing.
import type { APIRoute } from "astro";
import { authed, json, readJson } from "../../server/auth";
import { structured } from "../../server/gemini";
import { DRAFT_SCHEMA, PROFILE_COLS, draftSystemPrompt, type Profile } from "../../server/prompts";
import type { DraftItem } from "../../lib/types";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;

  const body = await readJson<{ text?: string }>(request);
  const text = body?.text?.trim().slice(0, 500);
  if (!text) return json({ error: "Type a word first." }, 400);

  const { data: profile } = await a.db.from("profiles").select(PROFILE_COLS).eq("id", a.user.id).maybeSingle();
  try {
    const item = await structured<DraftItem>({
      system: draftSystemPrompt(profile as Profile | null),
      user: text,
      schema: DRAFT_SCHEMA,
      temperature: 0.4,
    });
    if (!item?.term) return json({ error: "Couldn't make a card from that — try rephrasing." }, 502);
    return json({ item });
  } catch (e) {
    console.error("draft failed:", e);
    return json({ error: "Sensei is busy — try again in a moment." }, 502);
  }
};
