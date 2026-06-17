"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  lookupAccent,
  pitchPattern,
  accentType,
  ACCENT_TYPE_META,
} from "@/lib/pitch";

// Renders a kana reading with classic overline + downstep pitch-accent notation:
// a line over the high morae, with a hook where the pitch falls. The overline is
// colored by accent type (平板/頭高/中高/尾高) and a small type tag follows. Falls
// back to the plain reading while loading or when the word isn't in the dictionary.
export function PitchAccent({
  term,
  reading,
  className,
  showTag = true,
}: {
  term: string;
  reading: string;
  className?: string;
  showTag?: boolean;
}) {
  const [accent, setAccent] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    lookupAccent(term, reading).then((a) => {
      if (alive) setAccent(a);
    });
    return () => {
      alive = false;
    };
  }, [term, reading]);

  if (accent == null) {
    return <span className={cn("font-jp", className)}>{reading}</span>;
  }

  const pattern = pitchPattern(reading, accent);
  const type = accentType(reading, accent);
  const meta = ACCENT_TYPE_META[type];
  return (
    <span
      className={cn("inline-flex items-start font-jp", className)}
      title={`pitch accent: ${accent} (${meta.en})`}
    >
      {/* Force dark kana (not the inherited muted gray) so the colored
          overline/downstep clearly stands out. */}
      <span className="inline-flex items-start text-foreground">
        {pattern.map((p, i) => (
          <span
            key={i}
            className={cn(
              "leading-snug",
              meta.border,
              p.high && "border-t-[3px] border-solid",
              p.drop && "border-r-[3px] border-solid",
            )}
          >
            {p.mora}
          </span>
        ))}
      </span>
      {showTag && (
        <sup className={cn("ml-0.5 text-[9px] font-medium", meta.text)}>
          {meta.jp}
        </sup>
      )}
    </span>
  );
}
