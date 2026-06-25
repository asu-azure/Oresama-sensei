"use client";

import { useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

/** Light/dark toggle. The `.dark` class on <html> is the source of truth (set
 *  pre-paint by the inline script in app/layout.tsx); this reads it via
 *  useSyncExternalStore (lint-clean, no effects) and flips it on click,
 *  remembering the choice. Initialized from the OS on first visit. */

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => obs.disconnect();
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  const reduce = useReducedMotion();
  // getServerSnapshot returns false so SSR/first paint renders a neutral icon;
  // the client snapshot reflects what the inline script already applied.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode / storage disabled — ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#0c0c0d" : "#e9e4d8");
  }

  const Icon = dark ? Moon : Sun;

  return (
    <button
      type="button"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={
            reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }
          }
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="flex items-center justify-center"
        >
          <Icon className="h-4 w-4" />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
