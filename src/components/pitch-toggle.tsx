"use client";

import { usePitch, setPitch } from "@/lib/use-pitch";
import { cn } from "@/lib/utils";

/** Small button to toggle pitch-accent marks on readings (global, per-device). */
export function PitchToggle({ className }: { className?: string }) {
  const on = usePitch();
  return (
    <button
      type="button"
      onClick={() => setPitch(!on)}
      title="Show pitch-accent marks on readings"
      aria-pressed={on}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        on
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:bg-surface-2",
        className,
      )}
    >
      <span className="border-t-2 border-current font-jp leading-none">ア</span>
      Pitch
    </button>
  );
}
