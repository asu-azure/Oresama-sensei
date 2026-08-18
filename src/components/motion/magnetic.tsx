"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Magnetic drift — an element leans toward the cursor while hovered, snapping
 * back on leave (portfolio `data-magnetic` behavior). Returns a ref to attach
 * to any element. No-op on coarse pointers, under reduced-motion, or when
 * `strength` is 0 (so non-magnetic Buttons attach no listeners at all).
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.4) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !strength) return;
    const fine = window.matchMedia("(pointer: fine)").matches;
    const motionOk = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!fine || !motionOk) return;

    const moveX = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const moveY = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    // The rect must be measured with the drift removed: getBoundingClientRect()
    // includes our own transform, so measuring per-move makes the element chase
    // its own centre — the delta shrinks as it leans and it settles well short
    // of `strength`. Capture the resting centre on enter instead (also avoids a
    // forced layout on every mousemove).
    let cx = 0;
    let cy = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      cx = r.left + r.width / 2 - (gsap.getProperty(el, "x") as number);
      cy = r.top + r.height / 2 - (gsap.getProperty(el, "y") as number);
    };

    const onEnter = () => measure();
    const onMove = (e: MouseEvent) => {
      moveX((e.clientX - cx) * strength);
      moveY((e.clientY - cy) * strength);
    };
    const onLeave = () => {
      moveX(0);
      moveY(0);
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      gsap.killTweensOf(el);
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
