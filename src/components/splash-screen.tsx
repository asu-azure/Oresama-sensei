"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TITLE = "俺様先生";

const CONFETTI = [
  { color: "#ff3366", x: 0,   y: -70,  size: 12, delay: 0.25 },
  { color: "#ffd600", x: 60,  y: -50,  size: 10, delay: 0.28 },
  { color: "#00bcd4", x: 75,  y: 10,   size: 14, delay: 0.22 },
  { color: "#ff6b35", x: 40,  y: 70,   size: 8,  delay: 0.30 },
  { color: "#a855f7", x: -55, y: 60,   size: 10, delay: 0.26 },
  { color: "#16a34a", x: -80, y: -10,  size: 16, delay: 0.20 },
];

/** Brief entrance splash shown once per full app load. */
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
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
          aria-hidden="true"
        >
          {/* Green glow blob */}
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 0.5, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute h-72 w-72 rounded-full blur-3xl"
            style={{ background: "#16a34a" }}
          />

          <div className="relative flex flex-col items-center gap-3">
            {/* Confetti burst dots */}
            {!reduce &&
              CONFETTI.map((dot, i) => (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{ x: dot.x, y: dot.y, opacity: 0, scale: 1 }}
                  transition={{
                    delay: dot.delay,
                    duration: 0.55,
                    ease: "easeOut",
                  }}
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    width: dot.size,
                    height: dot.size,
                    background: dot.color,
                  }}
                />
              ))}

            {/* Title characters */}
            <div className="flex">
              {TITLE.split("").map((ch, i) => (
                <motion.span
                  key={i}
                  initial={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, y: 26, scale: 0.5, rotate: -10 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
                  transition={
                    reduce
                      ? { duration: 0.25, delay: i * 0.04 }
                      : {
                          type: "spring",
                          stiffness: 460,
                          damping: 17,
                          delay: 0.07 * i,
                        }
                  }
                  className="font-jp text-5xl font-bold tracking-tight text-foreground sm:text-6xl"
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
              className="h-1 w-32 origin-left rounded-full bg-primary"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}