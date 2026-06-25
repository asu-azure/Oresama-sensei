"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const HOVER_SELECTOR =
  'a, button, [role="button"], [data-cursor], input, textarea, select, summary';

/**
 * Custom dot cursor (mix-blend-mode: difference) ported from the portfolio.
 * Grows on interactive hover and shows a contextual label when an element
 * carries `data-cursor="VIEW"` (etc.). Only active on fine pointers with motion
 * allowed — otherwise it stays hidden and the native cursor is kept.
 *
 * The dot is always mounted (so its ref exists when the effect runs) and simply
 * hidden via `display:none` until enabled.
 */
export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const fine = window.matchMedia("(pointer: fine)").matches;
    const motionOk = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || !motionOk) return;

    setEnabled(true);
    const html = document.documentElement;
    html.classList.add("has-cursor");

    const moveX = gsap.quickTo(dot, "x", { duration: 0.35, ease: "power3" });
    const moveY = gsap.quickTo(dot, "y", { duration: 0.35, ease: "power3" });

    const onMove = (e: MouseEvent) => {
      moveX(e.clientX);
      moveY(e.clientY);
    };

    const onOver = (e: MouseEvent) => {
      const target = (e.target as Element)?.closest?.(HOVER_SELECTOR);
      if (!target) {
        dot.classList.remove("is-hover", "is-label");
        return;
      }
      const label = target.getAttribute("data-cursor");
      if (label && labelRef.current) {
        labelRef.current.textContent = label;
        dot.classList.add("is-label");
        dot.classList.remove("is-hover");
      } else {
        dot.classList.add("is-hover");
        dot.classList.remove("is-label");
      }
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      html.classList.remove("has-cursor");
    };
  }, []);

  return (
    <div
      ref={dotRef}
      className="cursor"
      aria-hidden="true"
      style={enabled ? undefined : { display: "none" }}
    >
      <span className="cursor__dot" />
      <span ref={labelRef} className="cursor__label" />
    </div>
  );
}
