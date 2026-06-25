"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TITLE = "俺様先生";
const ROMAJI = "ORE-SAMA SENSEI";

/** Brief entrance splash shown once per full app load. Editorial FUI: the title
 *  rises in serif behind a thin cobalt rule, with a mono readout — replacing the
 *  old pop-art glitch. Theme-aware (CSS tokens) and reduced-motion safe. */
export function SplashScreen() {
  const reduce = !!useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 500 : 1250);
    return () => clearTimeout(t);
  }, [reduce]);

  const ease = [0.22, 1, 0.36, 1] as const;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-background"
          aria-hidden="true"
        >
          {/* Faint blueprint grid */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(var(--grid-line) 1px, transparent 1px)," +
                "linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
              backgroundSize: "clamp(48px, 8vw, 96px) clamp(48px, 8vw, 96px)",
              maskImage:
                "radial-gradient(ellipse at 50% 45%, #000 30%, transparent 85%)",
              WebkitMaskImage:
                "radial-gradient(ellipse at 50% 45%, #000 30%, transparent 85%)",
            }}
          />

          {/* Top + bottom mono chrome */}
          <span className="mono absolute left-[var(--pad,1.25rem)] top-6">
            俺様先生 / N2–N1
          </span>
          <span className="mono absolute right-[var(--pad,1.25rem)] top-6">
            LOADING
          </span>

          <div className="relative flex flex-col items-center gap-4">
            {/* Title rises out from behind a clip */}
            <div className="overflow-hidden">
              <motion.span
                initial={{ y: reduce ? 0 : "110%" }}
                animate={{ y: 0 }}
                transition={{ duration: reduce ? 0 : 0.9, ease }}
                className="serif block text-6xl font-medium tracking-tight sm:text-7xl"
                style={{ fontFamily: "var(--font-serif-jp)", lineHeight: 1.05 }}
              >
                {TITLE}
              </motion.span>
            </div>

            {/* Cobalt hairline draw */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: reduce ? 0 : 0.35, duration: 0.5, ease }}
              className="h-px w-48 origin-left"
              style={{
                background:
                  "linear-gradient(90deg, transparent, var(--accent) 25%, #18c4d6 50%, var(--accent) 75%, transparent)",
              }}
            />

            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduce ? 0 : 0.5, duration: 0.4 }}
              className="mono"
            >
              {ROMAJI}
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
