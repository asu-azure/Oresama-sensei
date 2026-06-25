"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Magnetic drift — an element leans toward the cursor while hovered, snapping
 * back on leave (portfolio `data-magnetic` behavior). Returns a ref to attach
 * to any element. No-op on coarse pointers or under reduced-motion.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.4) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const motionOk = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || !motionOk) return;

    const moveX = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const moveY = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      moveX((e.clientX - (r.left + r.width / 2)) * strength);
      moveY((e.clientY - (r.top + r.height / 2)) * strength);
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}

/** Wrapper convenience: <Magnetic><button/></Magnetic>. */
export function Magnetic({
  children,
  strength = 0.4,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useMagnetic<HTMLSpanElement>(strength);
  return (
    <span ref={ref} className={className} style={{ display: "inline-flex" }}>
      {children}
    </span>
  );
}
