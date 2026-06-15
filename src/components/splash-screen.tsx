"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TITLE = "俺様先生";

/** Brief entrance splash (Duolingo-style) shown once per full app load. */
export function SplashScreen() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduce ? 550 : 1250);
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
          <motion.div
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 0.55, scale: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="pointer-events-none absolute h-72 w-72 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative flex flex-col items-center gap-3">
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