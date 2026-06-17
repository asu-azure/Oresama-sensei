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
