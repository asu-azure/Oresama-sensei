"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPLASH_STROKES } from "@/lib/splash-art";
import { cn } from "@/lib/utils";

const TITLE = ["俺", "様", "先", "生"];

// How far apart (ms) each character begins its reveal.
const STAGGER = 340;
// Target window (ms) for one character's strokes to draw — kept fixed so the
// 14-stroke 様 doesn't drag relative to the 5-stroke 生.
const STROKE_WINDOW = 460;

/** One title kanji: its strokes draw on one-by-one (KanjiVG paths, dashoffset),
 *  then it glitches into the crisp glyph as the stroke layer fades out. */
function SplashChar({
  char,
  startDelay,
  reduce,
}: {
  char: string;
  startDelay: number;
  reduce: boolean;
}) {
  const strokes = useMemo(() => SPLASH_STROKES[char] ?? [], [char]);
  const refs = useRef<(SVGPathElement | null)[]>([]);
  // Reduced motion shows the crisp glyph immediately (no stroke draw / glitch).
  const [showGlyph, setShowGlyph] = useState(reduce);
  const [strokesDone, setStrokesDone] = useState(reduce);

  useEffect(() => {
    if (reduce) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const paths = refs.current
      .slice(0, strokes.length)
      .filter(Boolean) as SVGPathElement[];

    const n = paths.length || 1;
    const dur = Math.max(34, Math.round(STROKE_WINDOW / n));
    const stagger = Math.round(dur * 0.8);

    // Prime: each stroke hidden (dashoffset = full length), then visible glyph
    // is hidden until strokes complete.
    for (const p of paths) {
      const len = p.getTotalLength();
      p.style.transition = "none";
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
      p.style.opacity = "1";
    }
    if (paths[0]) void paths[0].getBoundingClientRect(); // force reflow

    let last = startDelay;
    paths.forEach((p, idx) => {
      const at = startDelay + idx * stagger;
      last = at + dur;
      timers.push(
        setTimeout(() => {
          p.style.transition = `stroke-dashoffset ${dur}ms linear`;
          p.style.strokeDashoffset = "0";
        }, at),
      );
    });

    // Strokes finished → reveal the crisp glyph (with the RGB glitch) and fade
    // the stroke layer out.
    timers.push(
      setTimeout(() => {
        setStrokesDone(true);
        setShowGlyph(true);
      }, last + 30),
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [char, startDelay, reduce, strokes]);

  return (
    <div className="relative h-16 w-16 sm:h-20 sm:w-20">
      {/* Stroke-draw layer (fades out once the glyph locks in) */}
      <svg
        viewBox="0 0 109 109"
        className={cn(
          "absolute inset-0 h-full w-full transition-opacity duration-200",
          strokesDone && "opacity-0",
        )}
        aria-hidden
      >
        <g
          fill="none"
          stroke="var(--primary)"
          strokeWidth="4.5"
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
              style={{ opacity: 0 }}
            />
          ))}
        </g>
      </svg>

      {/* Box sweep that wipes across the slot as this char reveals */}
      {!reduce && (
        <span
          className="splash-sweep"
          style={{ animationDelay: `${startDelay}ms` }}
          aria-hidden
        />
      )}

      {/* Crisp glyph */}
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center font-jp text-5xl font-bold tracking-tight sm:text-6xl",
          showGlyph ? "opacity-100" : "opacity-0",
          showGlyph && !reduce && "glitch-in",
        )}
        style={{ color: "var(--foreground)" }}
      >
        {char}
      </span>
    </div>
  );
}

/** Brief entrance splash shown once per full app load — the title draws stroke-
 *  by-stroke, glitches into place (flashcard-style RGB shift), then underlines.
 *  Theme-aware (uses CSS tokens) and reduced-motion safe. */
export function SplashScreen() {
  const reduce = !!useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 650 : 2150);
    return () => clearTimeout(t);
  }, [reduce]);

  // Underline fires after the last character has revealed.
  const underlineDelay = reduce ? 0.2 : (TITLE.length * STAGGER + 520) / 1000;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-background"
          aria-hidden="true"
        >
          {/* Faint green grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(var(--primary) 1px, transparent 1px)," +
                "linear-gradient(90deg, var(--primary) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
            }}
          />
          {/* Subtle scanlines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(to bottom, var(--foreground) 0, var(--foreground) 1px, transparent 2px, transparent 4px)",
            }}
          />
          {/* Soft green glow behind the title */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="pointer-events-none absolute h-72 w-72 rounded-full blur-3xl"
            style={{ background: "var(--primary)" }}
          />

          <div className="relative flex flex-col items-center gap-3">
            <div className="flex gap-1 sm:gap-2">
              {TITLE.map((ch, i) => (
                <SplashChar
                  key={ch}
                  char={ch}
                  startDelay={reduce ? 0 : i * STAGGER}
                  reduce={reduce}
                />
              ))}
            </div>

            {/* Rainbow + green underline */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                delay: underlineDelay,
                duration: 0.4,
                ease: "easeOut",
              }}
              className="h-1 w-44 origin-center rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--primary), var(--pop-cyan), var(--pop-pink), var(--primary))",
                boxShadow: "0 0 12px color-mix(in srgb, var(--primary) 60%, transparent)",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
