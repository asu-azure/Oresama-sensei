// Derive a "mastery" level for a knowledge item purely from its existing SRS
// state (no extra data needed). Used to color-code the vocab/grammar library.

export type MasteryLevel =
  | "new"
  | "struggling"
  | "learning"
  | "young"
  | "mastered";

export interface MasteryInfo {
  level: MasteryLevel;
  label: string;
  dot: string; // small status dot background
  chip: string; // badge: bg + text + border
  ring: string; // card border color
}

export interface SrsLike {
  srs_reps?: number | null;
  srs_lapses?: number | null;
  srs_stability?: number | null;
  srs_difficulty?: number | null;
  srs_interval?: number | null; // legacy fallback before the first FSRS review
}

const PRESET: Record<MasteryLevel, Omit<MasteryInfo, "level">> = {
  new: {
    label: "New",
    dot: "bg-zinc-400",
    chip: "bg-surface-2 text-muted border-border",
    ring: "border-border",
  },
  struggling: {
    label: "Struggling",
    dot: "bg-accent",
    chip: "bg-accent/10 text-accent border-accent/30",
    ring: "border-accent/40",
  },
  learning: {
    label: "Learning",
    dot: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    ring: "border-amber-500/40",
  },
  young: {
    label: "Young",
    dot: "bg-blue-500",
    chip: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    ring: "border-blue-500/40",
  },
  mastered: {
    label: "Mastered",
    dot: "bg-emerald-600",
    chip: "bg-emerald-600/10 text-emerald-700 border-emerald-600/30",
    ring: "border-emerald-600/40",
  },
};

/** Order used for legends/filters (new -> learning -> young -> mastered, then struggling). */
export const MASTERY_ORDER: MasteryLevel[] = [
  "new",
  "learning",
  "young",
  "mastered",
  "struggling",
];

export function masteryInfo(level: MasteryLevel): MasteryInfo {
  return { level, ...PRESET[level] };
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

/** Aggregate mastery for a group of items (e.g. all knowledge on a book page),
 *  for a single color: surface trouble first (any struggling → struggling; any
 *  not-yet-solid → learning), reward fully-solid groups (all young/mastered →
 *  mastered), else new. Returns null for an empty group (nothing studied yet). */
export function pageMastery(items: SrsLike[]): MasteryInfo | null {
  if (items.length === 0) return null;
  const levels = items.map((it) => masteryLevel(it).level);
  if (levels.includes("struggling")) return masteryInfo("struggling");
  if (levels.includes("learning")) return masteryInfo("learning");
  if (levels.includes("new") && levels.every((l) => l === "new"))
    return masteryInfo("new");
  if (levels.includes("new")) return masteryInfo("learning");
  if (levels.includes("young")) return masteryInfo("young");
  return masteryInfo("mastered");
}