"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

// Renders KanjiVG stroke paths (109×109 viewBox) and animates them "drawing"
// in order via stroke-dashoffset. This is our own trusted SVG (not markdown),
// so the markdown sanitizer doesn't apply.
export function StrokeOrder({
  strokes,
  className,
}: {
  strokes: string[];
  className?: string;
}) {
  const refs = useRef<(SVGPathElement | null)[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [playId, setPlayId] = useState(0);

  // The stroke-drawing is a core learning feature, so it always animates — even
  // when the OS "reduce motion" setting is on (which would otherwise freeze it).
  useEffect(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    const paths = refs.current.slice(0, strokes.length).filter(Boolean) as SVGPathElement[];

    // Prime: hide every stroke (dashoffset = full length).
    for (const p of paths) {
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    }
    // Force a reflow so the priming styles apply before we animate.
    if (paths[0]) void paths[0].getBoundingClientRect();

    let delay = 0;
    for (const p of paths) {
      const len = p.getTotalLength();
      const dur = Math.max(260, Math.round(len * 7));
      const t = setTimeout(() => {
        p.style.transition = `stroke-dashoffset ${dur}ms linear`;
        p.style.strokeDashoffset = "0";
      }, delay);
      timers.current.push(t);
      delay += dur + 110;
    }

    return () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    };
  }, [playId, strokes]);

  return (
    <div className={cn("relative aspect-square", className)}>
      <svg viewBox="0 0 109 109" className="h-full w-full">
        {/* grid guides */}
        <g stroke="var(--border)" strokeWidth="0.6" strokeDasharray="3 4">
          <line x1="54.5" y1="0" x2="54.5" y2="109" />
          <line x1="0" y1="54.5" x2="109" y2="54.5" />
        </g>
        {/* faint full shape underneath */}
        <g
          fill="none"
          stroke="var(--muted)"
          strokeOpacity="0.16"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {strokes.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* animated strokes on top */}
        <g
          fill="none"
          stroke="var(--foreground)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {strokes.map((d, i) => (
            <path
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              d={d}
            />
          ))}
        </g>
      </svg>
      <button
        type="button"
        onClick={() => setPlayId((v) => v + 1)}
        aria-label="Replay stroke order"
        className="absolute bottom-1 right-1 rounded-full border border-border bg-surface/80 p-1.5 text-muted backdrop-blur transition-colors hover:text-foreground"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  );
}
