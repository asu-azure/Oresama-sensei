"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TITLE = "俺様先生";

// Splash-local palette — deliberately NOT the app's green brand tokens, so the
// entrance reads as a bright, futuristic "boot". The rest of the app stays green.
const NEON = "#38bdf8"; // electric blue
const NEON_BRIGHT = "#22d3ee"; // cyan accent
const BG = "#020617"; // deep navy

/** Brief entrance splash shown once per full app load — a neon cyber-grid boot. */
export function SplashScreen() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 550 : 1350);
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
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ background: BG }}
          aria-hidden="true"
        >
          {/* Perspective neon grid floor */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
            style={{ perspective: "320px", perspectiveOrigin: "50% 0%" }}
          >
            <div
              className={reduce ? undefined : "splash-grid"}
              style={{
                position: "absolute",
                inset: "-50% -50% 0 -50%",
                transform: "rotateX(72deg)",
                transformOrigin: "50% 100%",
                backgroundImage:
                  `linear-gradient(${NEON}55 1px, transparent 1px),` +
                  `linear-gradient(90deg, ${NEON}55 1px, transparent 1px)`,
                backgroundSize: "40px 40px",
                maskImage: "linear-gradient(to top, #000 8%, transparent 78%)",
                WebkitMaskImage:
                  "linear-gradient(to top, #000 8%, transparent 78%)",
              }}
            />
          </div>

          {/* Radial blue glow behind the title */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute h-80 w-80 rounded-full blur-3xl"
            style={{ background: `${NEON}40` }}
          />

          {/* Glowing horizon line */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-1/2 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${NEON_BRIGHT}, transparent)`,
              boxShadow: `0 0 18px ${NEON}`,
            }}
          />

          {/* Faint scanlines */}
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 2px, ${NEON}22 3px)`,
            }}
          />

          {/* Title */}
          <div className="relative flex flex-col items-center gap-4">
            <div className="flex">
              {TITLE.split("").map((ch, i) => (
                <motion.span
                  key={i}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: 22, scale: 0.6 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={
                    reduce
                      ? { duration: 0.25, delay: i * 0.04 }
                      : {
                          type: "spring",
                          stiffness: 440,
                          damping: 18,
                          delay: 0.08 * i,
                        }
                  }
                  className="font-jp text-5xl font-bold tracking-tight sm:text-6xl"
                  style={{
                    color: "#ffffff",
                    textShadow: `0 0 8px ${NEON_BRIGHT}, 0 0 22px ${NEON}, 0 0 40px ${NEON}`,
                  }}
                >
                  {ch}
                </motion.span>
              ))}
            </div>

            {/* Underline */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{
                delay: reduce ? 0.2 : 0.42,
                duration: 0.4,
                ease: "easeOut",
              }}
              className="h-0.5 w-40 origin-center rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${NEON_BRIGHT}, transparent)`,
                boxShadow: `0 0 12px ${NEON}`,
              }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
