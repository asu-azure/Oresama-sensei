"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * App-wide smooth (inertia) scroll — ported from the portfolio's Lenis setup.
 * Mounts once, drives the window scroll via requestAnimationFrame, and tags
 * <html> with `.lenis` so the CSS plumbing (height:auto, scroll-behavior:auto)
 * applies. Nested scrollers can opt out with `data-lenis-prevent`.
 *
 * Renders nothing — it just installs the behavior. Skipped entirely when the
 * user prefers reduced motion (native scroll is left untouched).
 */
export function SmoothScroll() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Let genuinely-scrollable nested areas (chat history, drawers) win.
      prevent: (node: Element) =>
        node.hasAttribute?.("data-lenis-prevent"),
    });

    // Expose for velocity-driven effects (e.g. heading skew) without prop-drilling.
    (window as unknown as { __lenis?: Lenis }).__lenis = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      delete (window as unknown as { __lenis?: Lenis }).__lenis;
    };
  }, []);

  return null;
}
