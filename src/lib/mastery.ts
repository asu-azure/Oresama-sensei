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
  srs_interval?: number | null;
  srs_ease?: number | null;
  srs_lapses?: number | null;
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
  const interval = item.srs_interval ?? 0;
  const ease = item.srs_ease ?? 2.5;
  const lapses = item.srs_lapses ?? 0;

  let level: MasteryLevel;
  if (reps === 0) level = "new";
  else if (lapses >= 2 || ease <= 1.6) level = "struggling";
  else if (interval < 7) level = "learning";
  else if (interval < 21) level = "young";
  else level = "mastered";

  return masteryInfo(level);
}