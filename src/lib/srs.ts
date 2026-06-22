// Spaced repetition powered by FSRS (Free Spaced Repetition Scheduler, the
// modern Difficulty/Stability/Retrievability model). We wrap `ts-fsrs` and map
// its Card <-> our knowledge_items columns.
//
// SERVER-ONLY: this imports ts-fsrs. Client code may import the `Rating` *type*
// only (`import type`), which is erased — never import a value from here client-side.

import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating as FsrsRating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";

/** Our rating strings (unchanged across the UI). */
export type Rating = "again" | "hard" | "good" | "easy";

const RATING_MAP: Record<Rating, Grade> = {
  again: FsrsRating.Again,
  hard: FsrsRating.Hard,
  good: FsrsRating.Good,
  easy: FsrsRating.Easy,
};

/** A knowledge_items row's scheduling state (as stored). */
export interface SrsRow {
  srs_stability?: number | null;
  srs_difficulty?: number | null;
  srs_state?: number | null;
  srs_reps?: number | null;
  srs_lapses?: number | null;
  srs_interval?: number | null; // legacy SM-2 interval (days); used to seed
  srs_last_review?: string | null;
  last_seen?: string | null; // fallback last_review for legacy items
}

/** The column bag written back after a review. */
export interface SrsUpdate {
  srs_stability: number;
  srs_difficulty: number;
  srs_state: number;
  srs_interval: number;
  srs_reps: number;
  srs_lapses: number;
  srs_due: string;
  srs_last_review: string;
}

// Target 90% retention; cap intervals at a year.
const f = fsrs(
  generatorParameters({ request_retention: 0.9, maximum_interval: 365 }),
);

/** Build an FSRS Card from a stored row. New items start empty; legacy SM-2
 *  items (have reps but no FSRS state) are seeded from their old interval so
 *  progress isn't lost. */
function cardFromRow(row: SrsRow, now: Date): Card {
  const card = createEmptyCard(now);
  if (row.srs_stability != null && row.srs_difficulty != null) {
    card.stability = row.srs_stability;
    card.difficulty = row.srs_difficulty;
    card.state = (row.srs_state ?? State.Review) as State;
    card.reps = row.srs_reps ?? 0;
    card.lapses = row.srs_lapses ?? 0;
    card.scheduled_days = row.srs_interval ?? 0;
    const lr = row.srs_last_review ?? row.last_seen;
    if (lr) card.last_review = new Date(lr);
  } else if ((row.srs_reps ?? 0) > 0) {
    card.stability = Math.max(0.5, row.srs_interval ?? 1);
    card.difficulty = 5;
    card.state = State.Review;
    card.reps = row.srs_reps ?? 0;
    card.lapses = row.srs_lapses ?? 0;
    card.scheduled_days = row.srs_interval ?? 0;
    card.last_review = new Date(row.srs_last_review ?? row.last_seen ?? now);
  }
  return card;
}

/** Schedule the next review for `rating`. Returns the columns to persist. */
export function schedule(
  row: SrsRow,
  rating: Rating,
  now: Date = new Date(),
): SrsUpdate {
  const { card: n } = f.next(cardFromRow(row, now), now, RATING_MAP[rating]);
  return {
    srs_stability: n.stability,
    srs_difficulty: n.difficulty,
    srs_state: n.state,
    srs_interval: n.scheduled_days,
    srs_reps: n.reps,
    srs_lapses: n.lapses,
    srs_due: n.due.toISOString(),
    srs_last_review: (n.last_review ?? now).toISOString(),
  };
}

/** FSRS-predicted probability (0–100) that the learner recalls this item right
 *  now, given its stability and time elapsed. Returns null for brand-new items
 *  (no reps yet), which have no meaningful score. Server-only (imports ts-fsrs). */
export function retrievability(
  row: SrsRow,
  now: Date = new Date(),
): number | null {
  if ((row.srs_reps ?? 0) === 0) return null;
  const r = f.get_retrievability(cardFromRow(row, now), now, false);
  if (typeof r !== "number" || Number.isNaN(r)) return null;
  return Math.round(r * 100);
}

/** A point on the projected aggregate forgetting curve. */
export interface ForecastPoint {
  day: number; // days from `now`
  retention: number; // 0–1, averaged over reviewed items
}

/** Project the library-wide average recall over the next `days`, assuming NO
 *  further reviews. For each future day we ask FSRS for each reviewed item's
 *  retrievability at that date and average them. Day 0 ≈ "right now". Items with
 *  no reps yet are ignored (they have no curve). Server-only (imports ts-fsrs). */
export function retentionForecast(
  rows: SrsRow[],
  days = 30,
  now: Date = new Date(),
): ForecastPoint[] {
  const reviewed = rows.filter((r) => (r.srs_reps ?? 0) > 0);
  const out: ForecastPoint[] = [];
  for (let d = 0; d <= days; d++) {
    const at = new Date(now.getTime() + d * 86_400_000);
    if (reviewed.length === 0) {
      out.push({ day: d, retention: 0 });
      continue;
    }
    let sum = 0;
    for (const r of reviewed) {
      const v = f.get_retrievability(cardFromRow(r, at), at, false);
      sum += typeof v === "number" && !Number.isNaN(v) ? v : 0;
    }
    out.push({ day: d, retention: sum / reviewed.length });
  }
  return out;
}

/** Current memory-health distribution: how many reviewed items are at strong /
 *  fading / weak recall right now, plus how many are still new. Buckets on the
 *  same retrievability() the review page already shows. */
export interface HealthBuckets {
  strong: number; // recall >= 85%
  fading: number; // 60–84%
  weak: number; // < 60%
  new: number; // not yet reviewed
}

export function healthBuckets(
  rows: SrsRow[],
  now: Date = new Date(),
): HealthBuckets {
  const b: HealthBuckets = { strong: 0, fading: 0, weak: 0, new: 0 };
  for (const r of rows) {
    const score = retrievability(r, now);
    if (score === null) b.new++;
    else if (score >= 85) b.strong++;
    else if (score >= 60) b.fading++;
    else b.weak++;
  }
  return b;
}

export type IntervalPreview = Record<Rating, string>;

function fmt(due: Date, now: Date): string {
  const ms = due.getTime() - now.getTime();
  if (ms <= 60_000) return "now";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

/** The next interval each rating would produce (for button labels). */
export function previewIntervals(
  row: SrsRow,
  now: Date = new Date(),
): IntervalPreview {
  const rep = f.repeat(cardFromRow(row, now), now);
  return {
    again: fmt(rep[FsrsRating.Again].card.due, now),
    hard: fmt(rep[FsrsRating.Hard].card.due, now),
    good: fmt(rep[FsrsRating.Good].card.due, now),
    easy: fmt(rep[FsrsRating.Easy].card.due, now),
  };
}
