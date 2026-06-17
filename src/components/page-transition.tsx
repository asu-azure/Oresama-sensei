"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** NicoNico-MV-style route change: a bright geometric panel sweeps across while
 *  the new page fades/slides in. Reduced-motion → a plain quick fade, no wipe.
 *  Keyed on pathname so it fires on every navigation. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>

      {/* Flash-wipe panel — a skewed bright bar swept across on each change.
          Pure-CSS one-shot (keyed on pathname → replays each navigation); the
          keyframe fades fully out at the end so nothing lingers on tall screens. */}
      <div
        key={`wipe-${pathname}`}
        aria-hidden="true"
        className="pointer-events-none fixed inset-y-0 left-0 z-[60] w-1/3"
        style={{
          animation: "pop-wipe 0.5s ease-out forwards",
          background:
            "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--primary) 85%, transparent) 45%, var(--pop-cyan) 50%, color-mix(in srgb, var(--primary) 85%, transparent) 55%, transparent 100%)",
        }}
      />
    </div>
  );
}
