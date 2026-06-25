"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

/**
 * Mask-reveal — child content rises out from behind a clip when scrolled into
 * view (portfolio `.reveal-mask`). Triggers any descendant `.hl` highlight
 * sweep at the same time. Under reduced motion it renders immediately, static.
 */
export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      el.querySelectorAll(".hl, .hl--v").forEach((h) => h.classList.add("is-on"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            el.querySelectorAll(".hl, .hl--v").forEach((h) =>
              h.classList.add("is-on"),
            );
            io.disconnect();
          }
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return createElement(
    as,
    { ref, className, style: { overflow: "hidden" } },
    <span
      style={{
        display: "block",
        transform: shown ? "translateY(0)" : "translateY(110%)",
        opacity: shown ? 1 : 0,
        transition: `transform 0.9s cubic-bezier(0.22,1,0.36,1) ${delay}s, opacity 0.9s ease ${delay}s`,
        willChange: "transform",
      }}
    >
      {children}
    </span>,
  );
}

const SCRAMBLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&/0123456789";

/**
 * Decode/scramble text — characters resolve left→right from random glyphs to
 * the final string on mount (portfolio hero/ledger effect). Static under
 * reduced motion.
 */
export function Decode({
  text,
  className,
  duration = 1100,
}: {
  text: string;
  className?: string;
  duration?: number;
}) {
  const [out, setOut] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOut(text);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(p * text.length);
      let s = "";
      for (let i = 0; i < text.length; i++) {
        if (i < revealed || text[i] === " ") s += text[i];
        else s += SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      }
      setOut(s);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration]);

  return <span className={className}>{out}</span>;
}
