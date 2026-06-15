// Lightweight SM-2-style spaced repetition.
// Ratings map to how well the learner recalled an item; we return the next
// schedule (interval in days, ease factor, due date).

export type Rating = "again" | "hard" | "good" | "easy";

export interface SrsState {
  srs_interval: number;
  srs_ease: number;
  srs_reps: number;
  srs_lapses: number;
}

export interface SrsUpdate extends SrsState {
  srs_due: string;
}

const MIN_EASE = 1.3;
const DAY_MS = 86_400_000;

export function schedule(cur: Partial<SrsState>, rating: Rating): SrsUpdate {
  let interval = cur.srs_interval ?? 0;
  let ease = cur.srs_ease ?? 2.5;
  let reps = cur.srs_reps ?? 0;
  let lapses = cur.srs_lapses ?? 0;

  switch (rating) {
    case "again":
      reps = 0;
      lapses += 1;
      ease = Math.max(MIN_EASE, ease - 0.2);
      interval = 0; // due again today
      break;
    case "hard":
      ease = Math.max(MIN_EASE, ease - 0.15);
      interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
      reps += 1;
      break;
    case "good":
      interval =
        reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
      reps += 1;
      break;
    case "easy":
      ease = ease + 0.15;
      interval = reps === 0 ? 2 : Math.round(Math.max(interval * ease * 1.3, 4));
      reps += 1;
      break;
  }

  interval = Math.max(0, interval);
  const due = new Date(Date.now() + interval * DAY_MS).toISOString();

  return {
    srs_interval: interval,
    srs_ease: ease,
    srs_reps: reps,
    srs_lapses: lapses,
    srs_due: due,
  };
}
