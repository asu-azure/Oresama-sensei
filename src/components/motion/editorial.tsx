"use client";

import {
  createElement,
  type ElementType,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useInView } from "@/components/motion/use-in-view";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   The editorial motion kit — small, composable pieces that reproduce the
   portfolio's signature flourishes (gradient draw-line, highlight-box sweep,
   flow-gradient display words, running line, marquee) in the React/Tailwind app.
--------------------------------------------------------------------------- */

/** Thin cobalt→cyan→amber line that draws in from the left on view. */
export function Gline({
  className,
  full,
}: {
  className?: string;
  full?: boolean;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn("gline", full && "gline--full", inView && "is-on", className)}
    />
  );
}

type HlVariant = "blue" | "cyan" | "amber" | "mix";

/** Animated highlight box that sweeps over a word/phrase the first time it
 *  scrolls into view (horizontal by default; vertical for JP columns). */
export function Highlight({
  children,
  variant = "blue",
  vertical = false,
  className,
}: {
  children: ReactNode;
  variant?: HlVariant;
  vertical?: boolean;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0.6 });
  return (
    <span
      ref={ref}
      className={cn(
        vertical ? "hl--v" : "hl",
        `hl--g-${variant}`,
        inView && "is-on",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Flow-gradient display text (cobalt→cyan→amber, looping). Use on big display
 *  words only — never body copy. */
export function FlowText({
  children,
  as = "span",
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  return createElement(
    as,
    { className: cn("flow-text", className) },
    children,
  );
}

/** A thin gradient bar whose lit segment runs left→right on a loop. Pass
 *  `fixedTop` to pin it across the very top of the viewport. */
export function RunningLine({
  className,
  fixedTop = false,
  style,
}: {
  className?: string;
  fixedTop?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("run-line", fixedTop && "run-line--fixed", className)}
      style={style}
    />
  );
}

/** Big-fat Japanese display word (financial-create motif). A bold serif-JP
 *  statement with an optional mono kicker; can flow-gradient or run vertically.
 *  Decorative — pair with the English title nearby. */
export function JpDisplay({
  word,
  label,
  flow = false,
  vertical = false,
  className,
}: {
  word: string;
  label?: string;
  flow?: boolean;
  vertical?: boolean;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  return (
    <div ref={ref} className={cn("select-none", className)}>
      {label && (
        <p
          className="mono mb-2"
          style={{
            opacity: inView ? 1 : 0,
            transition: "opacity 0.6s var(--ease)",
          }}
        >
          {label}
        </p>
      )}
      <div
        aria-hidden="true"
        className={cn(
          "font-semibold leading-[0.95] tracking-tight",
          flow && "flow-text",
          vertical
            ? "text-5xl sm:text-6xl"
            : "text-6xl sm:text-7xl md:text-8xl",
        )}
        style={{
          fontFamily: "var(--font-serif-jp)",
          writingMode: vertical ? "vertical-rl" : undefined,
          textOrientation: vertical ? "upright" : undefined,
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(14px)",
          transition:
            "opacity 0.8s var(--ease) 0.05s, transform 0.8s var(--ease) 0.05s",
        }}
      >
        {word}
      </div>
    </div>
  );
}

/** Wraps a block and adds `.is-in` once it scrolls into view, so descendant
 *  chart elements (.spark / .draw-path / .bar-rise / .glow) play their
 *  entrance. */
export function InView({
  children,
  as = "div",
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.25 });
  return createElement(
    as,
    { ref, className: cn(inView && "is-in", className) },
    children,
  );
}

/** Seamless horizontal marquee. Renders the children twice so the loop is
 *  continuous; pauses on hover. */
export function Marquee({
  children,
  className,
  gap = "3rem",
}: {
  children: ReactNode;
  className?: string;
  gap?: string;
}) {
  return (
    <div className={cn("overflow-hidden", className)} aria-hidden="true">
      <div className="marquee" style={{ gap }}>
        <div className="flex shrink-0 items-center" style={{ gap }}>
          {children}
        </div>
        <div className="flex shrink-0 items-center" style={{ gap }}>
          {children}
        </div>
      </div>
    </div>
  );
}
