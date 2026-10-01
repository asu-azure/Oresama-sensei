// POST /api/mnemonic — a personal memory story for one kanji, plus 2–3 example
// words that are added to the learner's words. Cached per user in `kanji`, so
// asking again is free unless `force` is set.
import type { APIRoute } from "astro";
import { authed, json, readJson } from "../../server/auth";
import { structured } from "../../server/gemini";
import { saveItem } from "../../server/items";
import { MNEMONIC_SCHEMA, PROFILE_COLS, mnemonicSystemPrompt, type Profile } from "../../server/prompts";

export const prerender = false;

type Example = { term: string; reading: string; meaning: string; example: string; jlpt_level: string };

/** Some models wrap ruby in backticks; strip them so furigana renders. */
const cleanRuby = (s = "") => s.replace(/`+\s*(<ruby>[\s\S]*?<\/ruby>)\s*`+/g, "$1").trim();

export const POST: APIRoute = async ({ request }) => {
  const a = await authed(request);
  if (a instanceof Response) return a;

  // The kanji page already has the offline data loaded, so it sends what the
  // prompt needs (a function can't read public/ on Vercel). Only shapes the
  // learner's own prompt, so it needs no further trust.
  const body = await readJson<{
    char?: string;
    force?: boolean;
    meanings?: string[];
    readings?: string[];
    components?: string[];
  }>(request);
  const char = [...(body?.char ?? "")][0];
  if (!char) return json({ error: "Which kanji?" }, 400);

  if (!body?.force) {
    const { data: cached } = await a.db
      .from("kanji")
      .select("mnemonic,examples")
      .eq("user_id", a.user.id)
      .eq("character", char)
      .maybeSingle();
    if (cached?.mnemonic) {
      return json({ mnemonic: cached.mnemonic, examples: cached.examples ?? [], added: 0 });
    }
  }

  const { data: profile } = await a.db.from("profiles").select(PROFILE_COLS).eq("id", a.user.id).maybeSingle();
  const list = (v: unknown, sep: string) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 20).join(sep).slice(0, 400) : "";
  const user = [
    `Kanji: ${char}`,
    `Meaning: ${list(body?.meanings, ", ") || "(unknown)"}`,
    `Readings: ${list(body?.readings, "、") || "(none)"}`,
    `Components: ${list(body?.components, " + ") || "(no sub-components)"}`,
  ].join("\n");

  let mnemonic = "";
  let examples: Example[] = [];
  try {
    const out = await structured<{ mnemonic?: string; examples?: Example[] }>({
      system: mnemonicSystemPrompt(profile as Profile | null),
      user,
      schema: MNEMONIC_SCHEMA,
      temperature: 0.9,
    });
    mnemonic = cleanRuby(out.mnemonic);
    examples = (out.examples ?? [])
      .filter((e) => e.term?.includes(char))
      .slice(0, 3)
      .map((e) => ({ ...e, example: cleanRuby(e.example) }));
  } catch (e) {
    console.error("mnemonic failed:", e);
  }
  if (!mnemonic) return json({ error: "Couldn't write a mnemonic right now." }, 502);

  let added = 0;
  for (const ex of examples) {
    try {
      const r = await saveItem(a.db, a.user.id, { ...ex, type: "vocab" }, { source: "lesson", source_type: "kanji" });
      if (r && !r.existed) added++;
    } catch (e) {
      console.error("example save failed:", e);
    }
  }

  await a.db.from("kanji").upsert(
    { user_id: a.user.id, character: char, mnemonic, examples, updated_at: new Date().toISOString() },
    { onConflict: "user_id,character" },
  );
  return json({ mnemonic, examples, added });
};
