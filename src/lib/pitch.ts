// Pitch-accent helpers. The accent number is the "downstep" mora (0 = heiban /
// flat, 1 = drop after mora 1, …). Dictionary data (kanjium, CC BY-SA 4.0) is
// lazy-loaded only on lookup so it never weighs down the initial bundle.

import { toHiragana } from "wanakana";

// Small kana that attach to the previous mora (ゃゅょ etc.); っ・ん・ー are their
// own morae.
const SMALL = new Set(
  "ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ".split(""),
);

export function splitMora(kana: string): string[] {
  const out: string[] = [];
  for (const ch of kana) {
    if (SMALL.has(ch) && out.length) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

export type Mora = { mora: string; high: boolean; drop: boolean };

/** High/low + downstep for each mora, per the standard accent rules. */
export function pitchPattern(reading: string, accent: number): Mora[] {
  const morae = splitMora(reading);
  const n = morae.length;
  const a = Math.max(0, Math.min(accent, n)); // clamp stray data
  return morae.map((mora, i) => {
    const pos = i + 1; // 1-based mora index
    let high: boolean;
    if (a === 0)
      high = pos !== 1; // heiban: low, then high to the end (no drop)
    else if (a === 1)
      high = pos === 1; // atamadaka: high, then low
    else high = pos >= 2 && pos <= a; // naka/odaka: low, high up to a, then low
    const drop = high && a >= 1 && pos === a; // pitch falls after this mora
    return { mora, high, drop };
  });
}

// The four classic accent types, derived from the downstep position + mora count.
export type AccentType = "heiban" | "atamadaka" | "nakadaka" | "odaka";

/** Classify a reading+accent into one of the four standard pitch-accent types. */
export function accentType(reading: string, accent: number): AccentType {
  const n = splitMora(reading).length;
  const a = Math.max(0, Math.min(accent, n));
  if (a === 0) return "heiban"; // flat, no downstep
  if (a === 1) return "atamadaka"; // drop after the first mora
  if (a >= n) return "odaka"; // drop after the last mora (heard on a following particle)
  return "nakadaka"; // drop somewhere in the middle
}

export type AccentTypeMeta = {
  jp: string; // Japanese label (平板 etc.)
  en: string; // romanized label
  border: string; // overline / hook color (all-sides class, used by legends)
  over: string; // top-border color class for a HIGH mora's overline
  drop: string; // right-border color class for the downstep hook
  text: string; // tag + legend text color
  dot: string; // legend swatch background
  /** Raw CSS color (Tailwind v4 theme var) for the drawn pitch line + its glow. */
  cssColor: string;
};

/** Per-type colors + labels. Data-only (Tailwind class strings), mirroring the
 *  PRESET map in mastery.ts so the renderer and legend share one source. */
export const ACCENT_TYPE_META: Record<AccentType, AccentTypeMeta> = {
  heiban: {
    jp: "平板",
    en: "heiban",
    border: "border-blue-500",
    over: "border-t-blue-500",
    drop: "border-r-blue-500",
    text: "text-blue-600",
    dot: "bg-blue-500",
    cssColor: "var(--color-blue-500)",
  },
  atamadaka: {
    jp: "頭高",
    en: "atamadaka",
    border: "border-rose-500",
    over: "border-t-rose-500",
    drop: "border-r-rose-500",
    text: "text-rose-600",
    dot: "bg-rose-500",
    cssColor: "var(--color-rose-500)",
  },
  nakadaka: {
    jp: "中高",
    en: "nakadaka",
    border: "border-amber-500",
    over: "border-t-amber-500",
    drop: "border-r-amber-500",
    text: "text-amber-600",
    dot: "bg-amber-500",
    cssColor: "var(--color-amber-500)",
  },
  odaka: {
    jp: "尾高",
    en: "odaka",
    border: "border-emerald-600",
    over: "border-t-emerald-600",
    drop: "border-r-emerald-600",
    text: "text-emerald-700",
    dot: "bg-emerald-600",
    cssColor: "var(--color-emerald-600)",
  },
};

/** Order used for the legend. */
export const ACCENT_TYPE_ORDER: AccentType[] = [
  "heiban",
  "atamadaka",
  "nakadaka",
  "odaka",
];

type Accents = {
  byWord: Record<string, number>;
  byReading: Record<string, number>;
};

let cache: Promise<Accents> | null = null;
function load(): Promise<Accents> {
  if (!cache) {
    cache = import("@/data/pitch/accents.json").then(
      (m) => m.default as Accents,
    );
  }
  return cache;
}

/** Accent number for a term+reading (lazy). Exact word match first, then a
 *  reading-only fallback; null if unknown. */
export async function lookupAccent(
  term: string,
  reading: string,
): Promise<number | null> {
  if (!reading) return null;
  const hira = toHiragana(reading);
  const { byWord, byReading } = await load();
  const key = `${term}\t${hira}`;
  if (key in byWord) return byWord[key];
  if (hira in byReading) return byReading[hira];
  return null;
}
