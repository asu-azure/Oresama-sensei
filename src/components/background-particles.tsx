"use client";

import type { CSSProperties } from "react";

/** Decorative floating shapes — vivid NicoNico MV-style pop-art layer.
 *  Fixed behind all content, pointer-events-none, aria-hidden. Animations use
 *  transform+opacity only → GPU-composited, negligible CPU cost. Content sits on
 *  opaque cards (bg-surface) so text stays readable over the busy background. */
export function BackgroundParticles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Halftone dot clusters in two corners (classic pop-art) */}
      <div
        className="halftone absolute -left-6 -top-6 h-44 w-44 text-[var(--pop-cyan)]"
        style={{ opacity: 0.18 }}
      />
      <div
        className="halftone absolute -bottom-6 -right-6 h-48 w-48 text-[var(--pop-pink)]"
        style={{ opacity: 0.16 }}
      />

      {/* Large faint glow — center-ish background, kept very subtle */}
      <Shape kind="circle" color="var(--pop-green)" size={240} pos={{ top: "34%", left: "46%" }} opacity={0.06} anim="pop-pulse 8s ease-in-out infinite" delay="0s" />

      {/* ---- vivid small/medium accents, mostly near the edges ---- */}
      <Shape kind="ring" color="var(--pop-cyan)" size={72} pos={{ top: "7%", right: "7%" }} opacity={0.32} anim="pop-float 6s ease-in-out infinite" delay="0.4s" />
      <Shape kind="plus" color="var(--pop-orange)" size={40} pos={{ top: "14%", left: "6%" }} opacity={0.3} anim="pop-float-x 7s ease-in-out infinite" delay="1.1s" />
      <Shape kind="square" color="var(--pop-pink)" size={30} pos={{ top: "40%", left: "3%" }} opacity={0.28} anim="pop-spin 8s linear infinite" delay="0.3s" className="hidden sm:block" />
      <Shape kind="circle" color="var(--pop-orange)" size={18} pos={{ top: "55%", right: "5%" }} opacity={0.34} anim="pop-pulse 4s ease-in-out infinite" delay="0.8s" className="hidden sm:block" />
      <Shape kind="square" color="var(--pop-purple)" size={24} pos={{ bottom: "16%", left: "6%" }} opacity={0.28} anim="pop-spin-rev 9s linear infinite" delay="2s" />
      <Shape kind="diamond" color="var(--pop-yellow)" size={26} pos={{ bottom: "20%", right: "9%" }} opacity={0.34} anim="pop-drift 10s ease-in-out infinite" delay="1.5s" className="hidden sm:block" />
      <Shape kind="line" color="var(--pop-green)" size={64} pos={{ top: "10%", left: "44%" }} opacity={0.3} anim="pop-float 5s ease-in-out infinite" delay="0.9s" className="hidden sm:block" />
      <Shape kind="line" color="var(--pop-purple)" size={48} pos={{ bottom: "30%", right: "30%" }} opacity={0.26} anim="pop-float-x 8s ease-in-out infinite" delay="2.7s" className="hidden md:block" />
      <Shape kind="circle" color="var(--pop-pink)" size={14} pos={{ top: "66%", left: "20%" }} opacity={0.34} anim="pop-pulse 3s ease-in-out infinite" delay="0.4s" />
      <Shape kind="triangle" color="var(--pop-cyan)" size={32} pos={{ top: "26%", right: "20%" }} opacity={0.26} anim="pop-drift 12s ease-in-out infinite" delay="3s" className="hidden sm:block" />
      <Shape kind="plus" color="var(--pop-pink)" size={18} pos={{ bottom: "9%", right: "24%" }} opacity={0.3} anim="pop-spin 6s linear infinite" delay="1.8s" />
      <Shape kind="diamond" color="var(--pop-purple)" size={20} pos={{ top: "5%", left: "30%" }} opacity={0.28} anim="pop-float-x 9s ease-in-out infinite" delay="2.5s" className="hidden sm:block" />
      <Shape kind="ring" color="var(--pop-orange)" size={40} pos={{ bottom: "12%", left: "40%" }} opacity={0.26} anim="pop-float 7s ease-in-out infinite" delay="1.3s" className="hidden md:block" />
      <Shape kind="square" color="var(--pop-green)" size={16} pos={{ top: "48%", right: "14%" }} opacity={0.3} anim="pop-spin 7s linear infinite" delay="3.4s" className="hidden md:block" />
      <Shape kind="triangle" color="var(--pop-yellow)" size={22} pos={{ bottom: "40%", left: "12%" }} opacity={0.3} anim="pop-drift 11s ease-in-out infinite" delay="0.6s" className="hidden md:block" />
    </div>
  );
}

type Pos = {
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
};

function Shape({
  kind,
  color,
  size,
  pos,
  opacity,
  anim,
  delay,
  className,
}: {
  kind: "circle" | "ring" | "square" | "diamond" | "triangle" | "plus" | "line";
  color: string;
  size: number;
  pos: Pos;
  opacity: number;
  anim: string;
  delay: string;
  className?: string;
}) {
  const base: CSSProperties = {
    position: "absolute",
    width: size,
    height: kind === "line" ? Math.max(4, Math.round(size / 12)) : size,
    opacity,
    animation: anim,
    animationDelay: delay,
    ...pos,
  };

  if (kind === "circle") {
    return <div className={cx("pop-particle rounded-full", className)} style={{ ...base, background: color }} />;
  }
  if (kind === "ring") {
    return (
      <div
        className={cx("pop-particle rounded-full", className)}
        style={{ ...base, border: `${Math.max(3, Math.round(size / 9))}px solid ${color}`, background: "transparent" }}
      />
    );
  }
  if (kind === "square") {
    return <div className={cx("pop-particle", className)} style={{ ...base, background: color }} />;
  }
  if (kind === "diamond") {
    return <div className={cx("pop-particle", className)} style={{ ...base, background: color, transform: "rotate(45deg)" }} />;
  }
  if (kind === "line") {
    return <div className={cx("pop-particle rounded-full", className)} style={{ ...base, background: color }} />;
  }
  if (kind === "triangle") {
    return (
      <div className={cx("pop-particle", className)} style={base}>
        <svg viewBox="0 0 32 32" fill={color} className="h-full w-full">
          <polygon points="16,2 30,30 2,30" />
        </svg>
      </div>
    );
  }
  // plus
  return (
    <div className={cx("pop-particle", className)} style={base}>
      <svg viewBox="0 0 32 32" fill={color} className="h-full w-full">
        <rect x="13" y="2" width="6" height="28" rx="2.5" />
        <rect x="2" y="13" width="28" height="6" rx="2.5" />
      </svg>
    </div>
  );
}

function cx(...parts: (string | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
