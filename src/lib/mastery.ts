// Derive a "mastery" level for a knowledge item purely from its existing SRS
// state (no extra data needed). Colours are CSS custom properties from
// global.css (--m-new … --m-mastered), so they follow the ink/paper spread.

export type MasteryLevel = "new" | "struggling" | "learning" | "young" | "mastered";

export interface MasteryInfo {
  level: MasteryLevel;
  label: string;
  /** CSS colour (a var() from global.css). */
  color: string;
}

export interface SrsLike {
  srs_reps?: number | null;
  srs_lapses?: number | null;
  srs_stability?: number | null;
  srs_difficulty?: number | null;
  srs_interval?: number | null; // legacy fallback before the first FSRS review
}

const LABEL: Record<MasteryLevel, string> = {
  new: "New",
  struggling: "Struggling",
  learning: "Learning",
  young: "Young",
  mastered: "Mastered",
};

/** Order used for legends/filters (new -> learning -> young -> mastered, then struggling). */
export const MASTERY_ORDER: MasteryLevel[] = ["new", "learning", "young", "mastered", "struggling"];

export function masteryInfo(level: MasteryLevel): MasteryInfo {
  return { level, label: LABEL[level], color: `var(--m-${level})` };
}

export function masteryLevel(item: SrsLike): MasteryInfo {
  const reps = item.srs_reps ?? 0;
  const lapses = item.srs_lapses ?? 0;
  const difficulty = item.srs_difficulty ?? 0;
  // FSRS "stability" ≈ days until recall drops to ~90%. Until an item's first
  // FSRS review fills it in, fall back to its old SM-2 interval.
  const stability = item.srs_stability ?? item.srs_interval ?? 0;

  let level: MasteryLevel;
  if (reps === 0) level = "new";
  else if (lapses >= 2 || difficulty >= 7) level = "struggling";
  else if (stability < 7) level = "learning";
  else if (stability < 21) level = "young";
  else level = "mastered";

  return masteryInfo(level);
}
