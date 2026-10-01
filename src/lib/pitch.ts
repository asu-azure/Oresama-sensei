// Pitch-accent helpers. The accent number is the "downstep" mora (0 = heiban /
// flat, 1 = drop after mora 1, …). Dictionary data (kanjium, CC BY-SA 4.0) is
// fetched one small shard per lookup, only when pitch marks are on.

import { toHiragana } from "wanakana";

// Small kana that attach to the previous mora (ゃゅょ etc.); っ・ん・ー are their
// own morae.
const SMALL = new Set("ぁぃぅぇぉゃゅょゎァィゥェォャュョヮ".split(""));

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
    if (a === 0) high = pos !== 1; // heiban: low, then high to the end (no drop)
    else if (a === 1) high = pos === 1; // atamadaka: high, then low
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

/** Labels per type; colours are --pitch-<type> in global.css. */
export const ACCENT_TYPE_META: Record<AccentType, { jp: string; en: string }> = {
  heiban: { jp: "平板", en: "heiban" },
  atamadaka: { jp: "頭高", en: "atamadaka" },
  nakadaka: { jp: "中高", en: "nakadaka" },
  odaka: { jp: "尾高", en: "odaka" },
};

export const ACCENT_TYPE_ORDER: AccentType[] = ["heiban", "atamadaka", "nakadaka", "odaka"];

// --- shards (layout: scripts/lib/shards.mjs) ----------------------------------

const PITCH_BUCKETS = 256;

/** 32-bit FNV-1a over UTF-16 code units — must match scripts/lib/shards.mjs. */
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const pitchShardKey = (hira: string) =>
  (fnv1a(hira) % PITCH_BUCKETS).toString(16).padStart(2, "0");

type Shard = { w: Record<string, number>; r: Record<string, number> };
const shards = new Map<string, Promise<Shard>>();

function loadShard(key: string): Promise<Shard> {
  let p = shards.get(key);
  if (!p) {
    p = fetch(`/data/pitch/${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<Shard>) : { w: {}, r: {} }))
      .catch(() => {
        shards.delete(key); // let a later lookup retry
        return { w: {}, r: {} };
      });
    shards.set(key, p);
  }
  return p;
}

/** Accent number for a term+reading. Exact word match first, then a
 *  reading-only fallback; null if unknown. */
export async function lookupAccent(term: string, reading: string): Promise<number | null> {
  if (!reading) return null;
  const hira = toHiragana(reading);
  const { w, r } = await loadShard(pitchShardKey(hira));
  const key = `${term}\t${hira}`;
  if (key in w) return w[key];
  if (hira in r) return r[hira];
  return null;
}
