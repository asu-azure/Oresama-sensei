"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import {
  lookupAccent,
  pitchPattern,
  accentType,
  ACCENT_TYPE_META,
} from "@/lib/pitch";

// How long (s) the draw of one mora's line waits behind the previous one, so the
// overline "burns" left→right like a lit fuse.
const STEP = 0.09;

// Renders a kana reading with classic overline + downstep pitch-accent notation:
// a line over the HIGH morae only, with a vertical hook where the pitch falls.
// Each line is an explicit element (low morae get nothing — no stray lines), it
// animates left→right with a soft glow, and is colored by accent type
// (平板/頭高/中高/尾高). Falls back to the plain reading while loading or when the
// word isn't in the dictionary.
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
      className={cn("inline-flex flex-wrap items-start font-jp", className)}
      title={`pitch accent: ${accent} (${meta.en})`}
    >
      {/* Force dark kana (not the inherited muted gray) so the colored
          overline/downstep clearly stands out. */}
      <span className="inline-flex items-start text-foreground">
        {pattern.map((p, i) => {
          // The line for a high mora draws after its left neighbours; the drop
          // hook fires just after that mora's overline reaches it.
          const lineStyle = {
            "--pitch-color": meta.cssColor,
            "--pitch-delay": `${i * STEP}s`,
          } as CSSProperties;
          const dropStyle = {
            "--pitch-color": meta.cssColor,
            "--pitch-delay": `${i * STEP + STEP}s`,
          } as CSSProperties;
          return (
            <span key={i} className="pitch-mora">
              {p.high && <span className="pitch-line" style={lineStyle} />}
              {p.drop && <span className="pitch-drop" style={dropStyle} />}
              {p.mora}
            </span>
          );
        })}
      </span>
      {showTag && (
        // A plain span (not <sup>): the superscript shift pushed this tiny CJK
        // label up where it got clipped. self-start keeps the "accent type" tag
        // up by the overline; leading-[1.5] + whitespace-nowrap keep 平板/頭高/…
        // fully legible, and the parent's flex-wrap lets it drop below a long
        // reading instead of being cut off by the card's overflow-hidden.
        <span
          className={cn(
            "ml-1 shrink-0 self-start whitespace-nowrap text-[10px] font-medium leading-[1.5]",
            meta.text,
          )}
        >
          {meta.jp}
        </span>
      )}
    </span>
  );
}
