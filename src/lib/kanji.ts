// Helpers for the bundled offline kanji dataset (built by scripts/build-kanji-data.mjs).
// Level data is split per JLPT level and lazy-loaded so the app only pulls what it shows.

import levelsData from "@/data/kanji/levels.json";

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

// --- Lazy per-level loaders (memoized) ---

const infoImport: Record<Level, () => Promise<{ default: unknown }>> = {
  N5: () => import("@/data/kanji/info/n5.json"),
  N4: () => import("@/data/kanji/info/n4.json"),
  N3: () => import("@/data/kanji/info/n3.json"),
  N2: () => import("@/data/kanji/info/n2.json"),
  N1: () => import("@/data/kanji/info/n1.json"),
};
const strokeImport: Record<Level, () => Promise<{ default: unknown }>> = {
  N5: () => import("@/data/kanji/strokes/n5.json"),
  N4: () => import("@/data/kanji/strokes/n4.json"),
  N3: () => import("@/data/kanji/strokes/n3.json"),
  N2: () => import("@/data/kanji/strokes/n2.json"),
  N1: () => import("@/data/kanji/strokes/n1.json"),
};

const infoCache = new Map<Level, Record<string, KanjiInfo>>();
const strokeCache = new Map<Level, Record<string, KanjiStrokes>>();

export async function loadInfo(level: Level): Promise<Record<string, KanjiInfo>> {
  if (!infoCache.has(level)) {
    const mod = await infoImport[level]();
    infoCache.set(level, mod.default as Record<string, KanjiInfo>);
  }
  return infoCache.get(level)!;
}
export async function loadStrokes(
  level: Level,
): Promise<Record<string, KanjiStrokes>> {
  if (!strokeCache.has(level)) {
    const mod = await strokeImport[level]();
    strokeCache.set(level, mod.default as Record<string, KanjiStrokes>);
  }
  return strokeCache.get(level)!;
}

export async function getInfo(ch: string): Promise<KanjiInfo | null> {
  const lvl = levelOf(ch);
  if (!lvl) return null;
  return (await loadInfo(lvl))[ch] ?? null;
}
export async function getStrokes(ch: string): Promise<KanjiStrokes | null> {
  const lvl = levelOf(ch);
  if (!lvl) return null;
  return (await loadStrokes(lvl))[ch] ?? null;
}
