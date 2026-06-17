"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const WIPE_TRAIL = [
  { top: "18%", size: 12, color: "var(--pop-pink)", round: true, delay: "0.04s" },
  { top: "38%", size: 9, color: "var(--pop-yellow)", round: false, delay: "0.10s" },
  { top: "58%", size: 14, color: "var(--pop-cyan)", round: false, delay: "0.02s" },
  { top: "72%", size: 8, color: "var(--pop-purple)", round: true, delay: "0.13s" },
  { top: "88%", size: 11, color: "var(--pop-orange)", round: true, delay: "0.07s" },
];

/** NicoNico-MV-style route change: a slim bright bar sweeps across with a short
 *  geometric trail while the new page fades/slides in. Reduced-motion → a plain
 *  quick fade, no wipe. Keyed on pathname so it fires on every navigation. */
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

      {/* Flash-wipe — a slim bright bar swept across on each change, with a few
          small geometric shapes trailing behind it. Pure-CSS one-shots keyed on
          pathname (replay each navigation); all fade fully out so nothing lingers. */}
      <div key={`wipe-${pathname}`} aria-hidden="true">
        {/* Slim glowing bar */}
        <div
          className="pointer-events-none fixed inset-y-0 left-0 z-[60] w-3"
          style={{
            animation: "pop-wipe 0.5s ease-out forwards",
            background:
              "linear-gradient(90deg, transparent, var(--pop-cyan), var(--primary), transparent)",
            boxShadow: "0 0 24px 6px color-mix(in srgb, var(--primary) 60%, transparent)",
          }}
        />
        {/* Trailing shapes at varied heights */}
        {WIPE_TRAIL.map((t, i) => (
          <div
            key={i}
            className="pointer-events-none fixed left-0 z-[60]"
            style={{
              top: t.top,
              width: t.size,
              height: t.size,
              background: t.color,
              borderRadius: t.round ? "9999px" : "2px",
              animation: `pop-wipe-trail 0.6s ease-out forwards`,
              animationDelay: t.delay,
            }}
          />
        ))}
      </div>
    </div>
  );
}
