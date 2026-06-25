"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const TITLE = "俺様先生";

/** Brief entrance splash shown once per full app load — the title glitches in
 *  all at once (flashcard-style RGB shift) behind a light sweep, then underlines.
 *  Theme-aware (uses CSS tokens) and reduced-motion safe. */
export function SplashScreen() {
  const reduce = !!useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 600 : 1250);
    return () => clearTimeout(t);
  }, [reduce]);

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
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute h-72 w-72 rounded-full blur-3xl"
            style={{ background: "var(--primary)" }}
          />

          <div className="relative flex flex-col items-center gap-3">
            {/* Title — all characters glitch in together behind a single sweep */}
            <div className="relative">
              <span
                className={cn(
                  "font-jp text-5xl font-bold tracking-tight sm:text-6xl",
                  !reduce && "glitch-in",
                )}
                style={{ color: "var(--foreground)" }}
              >
                {TITLE}
              </span>
              {!reduce && <span className="splash-sweep" aria-hidden />}
            </div>

            {/* Rainbow + green underline */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                delay: reduce ? 0.2 : 0.42,
                duration: 0.4,
                ease: "easeOut",
              }}
              className="h-1 w-44 origin-center rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, var(--primary), var(--pop-cyan), var(--pop-pink), var(--primary))",
                boxShadow:
                  "0 0 12px color-mix(in srgb, var(--primary) 60%, transparent)",
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
