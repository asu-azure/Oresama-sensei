"use client";

import { cn } from "@/lib/utils";
import { ACCENT_TYPE_META, ACCENT_TYPE_ORDER } from "@/lib/pitch";
import { usePitch } from "@/lib/use-pitch";

/** One-line legend decoding the four pitch-accent colors. Renders only when the
 *  pitch toggle is on, so it sits quietly beside readings until needed. */
export function PitchLegend({ className }: { className?: string }) {
  const on = usePitch();
  if (!on) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted",
        className,
      )}
    >
      {ACCENT_TYPE_ORDER.map((t) => {
        const meta = ACCENT_TYPE_META[t];
        return (
          <span key={t} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
            <span className="font-jp">{meta.jp}</span>
            <span className="text-muted/70">{meta.en}</span>
          </span>
        );
      })}
    </div>
  );
}
