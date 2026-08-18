"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

const HOVER_SELECTOR =
  'a, button, [role="button"], [data-cursor], input, textarea, select, summary';
/** Text-entry targets: we hand the native I-beam back rather than covering the
 *  caret with the dot (globals.css restores `cursor: text` for these). */
const TEXT_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * Custom cursor, in two layers:
 *
 *   - `.cursor__dot` — what you actually aim with. Pinned to the pointer with
 *     ZERO smoothing (a direct transform write, coalesced to one per frame via
 *     rAF). The native cursor is hidden app-wide, so any lag here is felt as the
 *     app not responding — the dot must be exactly under the hand.
 *   - `.cursor__ring` — a faint circle that trails behind on a GSAP tween. This
 *     is where the editorial motion character lives, at no cost to precision.
 *
 * Grows on interactive hover, shows a contextual label for `data-cursor="VIEW"`,
 * and dims over text fields. Only active on fine pointers with motion allowed —
 * otherwise it stays hidden and the native cursor is kept.
 *
 * Both layers are always mounted (so their refs exist when the effect runs) and
 * simply hidden until the pointer is first seen.
 */
export function Cursor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!root || !dot || !ring) return;

    const fineQ = window.matchMedia("(pointer: fine)");
    const motionQ = window.matchMedia("(prefers-reduced-motion: reduce)");
    const html = document.documentElement;

    // Re-evaluated whenever the media queries change, so plugging in a mouse or
    // toggling OS reduced-motion takes effect without a full reload. The (app)
    // layout persists across route changes, so a remount is otherwise rare.
    let teardown: (() => void) | null = null;

    function start() {
      if (teardown) return;
      setEnabled(true);
      html.classList.add("has-cursor");

      // The ring trails; the dot does not. `quickTo` reuses one tween instead of
      // allocating per move.
      const ringX = gsap.quickTo(ring, "x", { duration: 0.28, ease: "power3" });
      const ringY = gsap.quickTo(ring, "y", { duration: 0.28, ease: "power3" });

      let x = 0;
      let y = 0;
      let raf = 0;
      let seen = false;

      const flush = () => {
        raf = 0;
        // Direct write — no tween, no smoothing, no lag.
        dot!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        ringX(x);
        ringY(y);
      };

      const onMove = (e: PointerEvent | MouseEvent) => {
        x = e.clientX;
        y = e.clientY;
        if (!seen) {
          // First sighting: jump both layers to the pointer and reveal. Without
          // this the elements sit at (0,0) and visibly fly in from the corner.
          seen = true;
          dot!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
          gsap.set(ring, { x, y });
          root!.classList.add("is-live");
          return;
        }
        if (!raf) raf = requestAnimationFrame(flush);
      };

      const onOver = (e: MouseEvent) => {
        const el = e.target as Element | null;
        const target = el?.closest?.(HOVER_SELECTOR);
        root!.classList.toggle("is-text", !!el?.closest?.(TEXT_SELECTOR));
        if (!target) {
          root!.classList.remove("is-hover", "is-label");
          return;
        }
        const label = target.getAttribute("data-cursor");
        if (label && labelRef.current) {
          labelRef.current.textContent = label;
          root!.classList.add("is-label");
          root!.classList.remove("is-hover");
        } else {
          root!.classList.add("is-hover");
          root!.classList.remove("is-label");
        }
      };

      // Leaving the window used to freeze the dot wherever it was last seen.
      const onLeave = (e: MouseEvent) => {
        if (e.relatedTarget === null) root!.classList.remove("is-live");
      };
      const onEnter = () => root!.classList.add("is-live");
      const onDown = () => root!.classList.add("is-down");
      const onUp = () => root!.classList.remove("is-down");

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("mouseover", onOver, { passive: true });
      document.addEventListener("mouseout", onLeave, { passive: true });
      document.addEventListener("mouseover", onEnter, { passive: true });
      window.addEventListener("pointerdown", onDown, { passive: true });
      window.addEventListener("pointerup", onUp, { passive: true });

      teardown = () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("mouseover", onOver);
        document.removeEventListener("mouseout", onLeave);
        document.removeEventListener("mouseover", onEnter);
        window.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointerup", onUp);
        gsap.killTweensOf(ring);
        root!.classList.remove("is-live", "is-hover", "is-label", "is-text", "is-down");
        html.classList.remove("has-cursor");
        setEnabled(false);
        teardown = null;
      };
    }

    function sync() {
      if (fineQ.matches && !motionQ.matches) start();
      else teardown?.();
    }

    sync();
    fineQ.addEventListener("change", sync);
    motionQ.addEventListener("change", sync);

    return () => {
      fineQ.removeEventListener("change", sync);
      motionQ.removeEventListener("change", sync);
      teardown?.();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="cursor"
      aria-hidden="true"
      style={enabled ? undefined : { display: "none" }}
    >
      <span ref={ringRef} className="cursor__ring" />
      <span ref={dotRef} className="cursor__dot">
        <span ref={labelRef} className="cursor__label" />
      </span>
    </div>
  );
}
