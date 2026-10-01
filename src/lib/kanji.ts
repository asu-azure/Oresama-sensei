// Helpers for the offline kanji dataset (built by scripts/build-kanji-data.mjs).
// The level lists are bundled (13 KB); readings/meanings are fetched per JLPT
// level and stroke paths per codepoint bucket, only when something shows them.

import levelsData from "../data/kanji-levels.json";

export type Level = "N5" | "N4" | "N3" | "N2" | "N1";
export const LEVELS: Level[] = ["N5", "N4", "N3", "N2", "N1"];

export type KanjiInfo = {
  jlpt: Level;
  strokes: number | null;
  grade: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
};
export type KanjiComponent = { el: string; isRadical: boolean };
export type KanjiStrokes = { strokes: string[]; components: KanjiComponent[] };

const LEVELS_DATA = levelsData as Record<Level, string[]>;

const LEVEL_OF = new Map<string, Level>();
for (const lvl of LEVELS) {
  for (const ch of LEVELS_DATA[lvl] ?? []) LEVEL_OF.set(ch, lvl);
}

/** JLPT level of a kanji, or null if it isn't in the dataset. */
export function levelOf(ch: string): Level | null {
  return LEVEL_OF.get(ch) ?? null;
}

/** The kanji of a JLPT level, common-first. */
export function kanjiList(level: Level): string[] {
  return LEVELS_DATA[level] ?? [];
}

const KANJI_TEST = /[一-鿿㐀-䶿]/;

/** Whether a single character is a CJK ideograph we can look up. */
export function isKanji(ch: string): boolean {
  return KANJI_TEST.test(ch);
}

/** Unique kanji characters appearing in a string, in first-seen order. */
export function uniqueKanji(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of text) {
    if (isKanji(ch) && !seen.has(ch)) {
      seen.add(ch);
      out.push(ch);
    }
  }
  return out;
}

/** Link to a kanji's page. `from` is where Back should return to. */
export function kanjiHref(ch: string, from?: string): string {
  const q = new URLSearchParams({ c: ch });
  if (from) q.set("from", from);
  return `/kanji/view?${q}`;
}

// --- fetched shards (layout: scripts/lib/shards.mjs) -------------------------

const STROKE_BUCKETS = 64;
export const strokeBucket = (ch: string) =>
  String(ch.codePointAt(0)! % STROKE_BUCKETS).padStart(2, "0");

const jsonCache = new Map<string, Promise<unknown>>();
function getJson<T>(url: string): Promise<T> {
  let p = jsonCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return r.json();
    });
    p.catch(() => jsonCache.delete(url));
    jsonCache.set(url, p);
  }
  return p as Promise<T>;
}

export function loadInfo(level: Level): Promise<Record<string, KanjiInfo>> {
  return getJson(`/data/kanji/info/${level.toLowerCase()}.json`);
}

export async function getInfo(ch: string): Promise<KanjiInfo | null> {
  const lvl = levelOf(ch);
  if (!lvl) return null;
  return (await loadInfo(lvl))[ch] ?? null;
}

export async function getStrokes(ch: string): Promise<KanjiStrokes | null> {
  if (!levelOf(ch)) return null;
  const bucket = await getJson<Record<string, KanjiStrokes>>(
    `/data/kanji/strokes/${strokeBucket(ch)}.json`,
  );
  return bucket[ch] ?? null;
}

/** Kanji in a term we have data for, each with its primary English meaning. */
export async function kanjiGlosses(term: string): Promise<{ char: string; meaning: string }[]> {
  const chars = uniqueKanji(term).filter((c) => levelOf(c));
  return Promise.all(
    chars.map(async (c) => ({ char: c, meaning: (await getInfo(c))?.meanings?.[0] ?? "" })),
  );
}
