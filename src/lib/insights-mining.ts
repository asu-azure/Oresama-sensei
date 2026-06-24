// Pure data-mining helpers for the /insights analytics page. Each function takes
// already-fetched rows (knowledge_items and/or review_log) and returns plain,
// chart-ready arrays. NO database access and NO ts-fsrs import here, so this stays
// client-safe and cheap (mirrors src/lib/review-history.ts). All FSRS framing
// reuses the stored srs_* columns + src/lib/mastery.ts.

import { masteryLevel, type MasteryLevel, type SrsLike } from "@/lib/mastery";
import { sourceMeta } from "@/lib/source";

// ---- Row shapes (the columns the page fetches) ----------------------------

export interface MiningItem extends SrsLike {
  type: string;
  term: string;
  reading: string | null;
  jlpt_level: string | null;
  source_type: string | null;
}

export interface MiningLog {
  item_id: string;
  rating: string; // "again" | "hard" | "good" | "easy"
  reviewed_at: string;
  elapsed_days: number | null;
  retrievability: number | null; // FSRS-predicted recall (0..1) at review time
  stability_after?: number | null; // for per-item sawtooth (curve-compare)
}

// A single labelled bar (generic input to <BarList>).
export interface Bar {
  label: string;
  value: number;
  colorVar?: string;
  sub?: string; // optional secondary text (e.g. a percentage)
}

// ---- Composition -----------------------------------------------------------

const TYPE_LABEL: Record<string, string> = {
  vocab: "Vocabulary",
  grammar: "Grammar",
  expression: "Expressions",
};

/** Normalize the messy jlpt_level field ("N2", "N2/N1", "N3-N2", null) to a
 *  single primary bucket for grouping. Takes the HIGHEST level mentioned (lower
 *  N number = harder), so "N3/N2" counts as N2. */
export function primaryLevel(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const nums = (raw.toUpperCase().match(/N[1-5]/g) ?? []).map((n) => n);
  if (nums.length === 0) return "Other";
  // Smallest N number = highest level.
  nums.sort((a, b) => Number(a[1]) - Number(b[1]));
  return nums[0];
}

export function composition(items: MiningItem[]): {
  bySource: Bar[];
  byLevel: Bar[];
  byType: Bar[];
} {
  // By source_type, descending by count, with friendly labels + emoji.
  const srcCounts = new Map<string, number>();
  for (const it of items) {
    const key = it.source_type ?? "__none";
    srcCounts.set(key, (srcCounts.get(key) ?? 0) + 1);
  }
  const bySource: Bar[] = [...srcCounts.entries()]
    .map(([key, value]) => {
      const meta = key === "__none" ? { label: "Untagged", emoji: "•" } : sourceMeta(key);
      return { label: `${meta.emoji} ${meta.label}`, value };
    })
    .sort((a, b) => b.value - a.value);

  // By JLPT level, in difficulty order N1..N5 then Other.
  const ORDER = ["N1", "N2", "N3", "N4", "N5", "Other"];
  const lvlCounts = new Map<string, number>();
  for (const it of items) {
    const lv = primaryLevel(it.jlpt_level);
    lvlCounts.set(lv, (lvlCounts.get(lv) ?? 0) + 1);
  }
  const byLevel: Bar[] = ORDER.filter((lv) => lvlCounts.has(lv)).map((lv) => ({
    label: lv,
    value: lvlCounts.get(lv)!,
    colorVar: "var(--color-accent)",
  }));

  // By type.
  const typeCounts = new Map<string, number>();
  for (const it of items) {
    typeCounts.set(it.type, (typeCounts.get(it.type) ?? 0) + 1);
  }
  const byType: Bar[] = [...typeCounts.entries()]
    .map(([t, value]) => ({ label: TYPE_LABEL[t] ?? t, value }))
    .sort((a, b) => b.value - a.value);

  return { bySource, byLevel, byType };
}

// ---- Difficulty vs stability scatter --------------------------------------

export interface ScatterPoint {
  x: number; // stability (days)
  y: number; // difficulty (1..10)
  level: MasteryLevel;
  term: string;
}

/** Points for the difficulty(y) vs stability(x) scatter. Only items that have
 *  actually been reviewed (have FSRS state) — new items have no difficulty. */
export function difficultyScatter(items: MiningItem[]): ScatterPoint[] {
  const pts: ScatterPoint[] = [];
  for (const it of items) {
    const stab = it.srs_stability;
    const diff = it.srs_difficulty;
    if (stab == null || diff == null || (it.srs_reps ?? 0) === 0) continue;
    pts.push({
      x: stab,
      y: diff,
      level: masteryLevel(it).level,
      term: it.term,
    });
  }
  return pts;
}

// ---- Maturity (stability) buckets -----------------------------------------

const STABILITY_BUCKETS: { label: string; max: number }[] = [
  { label: "< 1 day", max: 1 },
  { label: "1–7 days", max: 7 },
  { label: "7–30 days", max: 30 },
  { label: "30–90 days", max: 90 },
  { label: "90 days +", max: Infinity },
];

/** How "mature" the memory of each reviewed item is, by FSRS stability. Also
 *  reports a "New (unreviewed)" bar for items with no reviews yet. */
export function stabilityBuckets(items: MiningItem[]): Bar[] {
  const counts = new Array(STABILITY_BUCKETS.length).fill(0);
  let unreviewed = 0;
  for (const it of items) {
    if ((it.srs_reps ?? 0) === 0 || it.srs_stability == null) {
      unreviewed++;
      continue;
    }
    const s = it.srs_stability;
    const idx = STABILITY_BUCKETS.findIndex((b) => s < b.max);
    counts[idx === -1 ? STABILITY_BUCKETS.length - 1 : idx]++;
  }
  const bars: Bar[] = STABILITY_BUCKETS.map((b, i) => ({
    label: b.label,
    value: counts[i],
  }));
  bars.push({ label: "New", value: unreviewed, colorVar: "var(--color-muted)" });
  return bars;
}

// ---- Review rating mix -----------------------------------------------------

const RATING_ORDER = ["again", "hard", "good", "easy"] as const;
export const RATING_COLOR: Record<string, string> = {
  again: "var(--color-accent)",
  hard: "var(--color-amber-500)",
  good: "var(--color-primary)",
  easy: "var(--color-emerald-600)",
};
const RATING_LABEL: Record<string, string> = {
  again: "Again",
  hard: "Hard",
  good: "Good",
  easy: "Easy",
};

export function ratingMix(logs: MiningLog[]): Bar[] {
  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.rating, (counts.get(l.rating) ?? 0) + 1);
  const total = logs.length || 1;
  return RATING_ORDER.filter((r) => counts.has(r)).map((r) => {
    const v = counts.get(r)!;
    return {
      label: RATING_LABEL[r],
      value: v,
      colorVar: RATING_COLOR[r],
      sub: `${Math.round((v / total) * 1000) / 10}%`,
    };
  });
}

// ---- Study rhythm: reviews by local hour ----------------------------------

const BANGKOK_OFFSET_HOURS = 7; // owner is in Thailand (UTC+7); no per-user tz column.

/** Reviews per local hour-of-day (0..23), so the daily study rhythm is readable. */
export function hourHistogram(logs: MiningLog[]): { hour: number; count: number }[] {
  const counts = new Array(24).fill(0);
  for (const l of logs) {
    const utcHour = new Date(l.reviewed_at).getUTCHours();
    const local = (utcHour + BANGKOK_OFFSET_HOURS) % 24;
    counts[local]++;
  }
  return counts.map((count, hour) => ({ hour, count }));
}

// ---- Retention quality by source ------------------------------------------

/** Pass-rate (good+easy) and lapse-rate (again) per source_type, joining reviews
 *  back to their item via an itemId -> source_type map. Surfaces which kinds of
 *  material actually stick. Only sources with at least `minReviews` reviews. */
export function passBySource(
  sourceById: Map<string, string | null>,
  logs: MiningLog[],
  minReviews = 10,
): { label: string; reviews: number; passPct: number; againPct: number }[] {
  const agg = new Map<string, { reviews: number; pass: number; again: number }>();
  for (const l of logs) {
    const src = sourceById.get(l.item_id) ?? "__none";
    const e = agg.get(src) ?? { reviews: 0, pass: 0, again: 0 };
    e.reviews++;
    if (l.rating === "good" || l.rating === "easy") e.pass++;
    if (l.rating === "again") e.again++;
    agg.set(src, e);
  }
  return [...agg.entries()]
    .filter(([, e]) => e.reviews >= minReviews)
    .map(([key, e]) => {
      const meta = key === "__none" ? { label: "Untagged", emoji: "•" } : sourceMeta(key);
      return {
        label: `${meta.emoji} ${meta.label}`,
        reviews: e.reviews,
        passPct: Math.round((e.pass / e.reviews) * 1000) / 10,
        againPct: Math.round((e.again / e.reviews) * 1000) / 10,
      };
    })
    .sort((a, b) => b.passPct - a.passPct);
}

// ---- Model calibration: predicted vs actual recall ------------------------

const ELAPSED_BUCKETS: { label: string; max: number }[] = [
  { label: "0–1d", max: 1 },
  { label: "1–3d", max: 3 },
  { label: "3–7d", max: 7 },
  { label: "7–14d", max: 14 },
  { label: "14d +", max: Infinity },
];

export interface CalibrationPoint {
  label: string;
  n: number;
  actualPct: number; // % of reviews recalled (good+easy)
  predictedPct: number; // avg FSRS-predicted retrievability
}

/** Bins reviews by how many days had elapsed, then compares the FSRS-predicted
 *  recall (stored `retrievability`) with what actually happened (good+easy). A
 *  gap means the scheduler is mis-calibrated for this learner. */
export function calibration(logs: MiningLog[]): CalibrationPoint[] {
  const buckets = ELAPSED_BUCKETS.map(() => ({ n: 0, pass: 0, predSum: 0 }));
  for (const l of logs) {
    if (l.elapsed_days == null) continue;
    let idx = ELAPSED_BUCKETS.findIndex((b) => l.elapsed_days! < b.max);
    if (idx === -1) idx = ELAPSED_BUCKETS.length - 1;
    const e = buckets[idx];
    e.n++;
    if (l.rating === "good" || l.rating === "easy") e.pass++;
    e.predSum += l.retrievability ?? 0;
  }
  return ELAPSED_BUCKETS.map((b, i) => {
    const e = buckets[i];
    return {
      label: b.label,
      n: e.n,
      actualPct: e.n ? Math.round((e.pass / e.n) * 1000) / 10 : 0,
      predictedPct: e.n ? Math.round((e.predSum / e.n) * 1000) / 10 : 0,
    };
  }).filter((p) => p.n > 0);
}

// ---- Leeches (problem words) ----------------------------------------------

export interface Leech {
  term: string;
  reading: string | null;
  level: string;
  source: string;
  lapses: number;
  difficulty: number;
  stability: number;
}

/** Top problem items: most lapses first, then hardest. Only items with at least
 *  one lapse OR high difficulty are interesting. */
export function leeches(items: MiningItem[], limit = 10): Leech[] {
  return items
    .filter((it) => (it.srs_reps ?? 0) > 0 && ((it.srs_lapses ?? 0) >= 1 || (it.srs_difficulty ?? 0) >= 7))
    .map((it) => {
      const meta = it.source_type ? sourceMeta(it.source_type) : { label: "Other", emoji: "•" };
      return {
        term: it.term,
        reading: it.reading,
        level: primaryLevel(it.jlpt_level),
        source: `${meta.emoji} ${meta.label}`,
        lapses: it.srs_lapses ?? 0,
        difficulty: Math.round((it.srs_difficulty ?? 0) * 10) / 10,
        stability: Math.round((it.srs_stability ?? 0) * 10) / 10,
      };
    })
    .sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty)
    .slice(0, limit);
}
