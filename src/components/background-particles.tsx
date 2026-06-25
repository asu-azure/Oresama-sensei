"use client";

/** Ambient background — editorial FUI. A faint blueprint grid (masked to a soft
 *  ellipse) with two cobalt/cyan glows. Pure radial-gradients (no `filter: blur`,
 *  which is a GPU killer when animated) and no infinite animation, so it costs
 *  essentially nothing to composite even on heavy chart pages. Fixed,
 *  pointer-events-none, aria-hidden. */
export function BackgroundParticles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Blueprint grid with a radial fade */}
      <div className="grid-bg" />

      {/* Soft cobalt + cyan glows — static, gradient-only (cheap to paint) */}
      <div
        className="absolute"
        style={{
          top: "-10%",
          left: "-5%",
          width: "55vw",
          height: "55vw",
          maxWidth: 720,
          maxHeight: 720,
          background:
            "radial-gradient(circle at center, var(--accent) 0%, transparent 60%)",
          opacity: 0.07,
        }}
      />
      <div
        className="absolute"
        style={{
          bottom: "-8%",
          right: "-5%",
          width: "45vw",
          height: "45vw",
          maxWidth: 560,
          maxHeight: 560,
          background:
            "radial-gradient(circle at center, #18c4d6 0%, transparent 62%)",
          opacity: 0.06,
        }}
      />
    </div>
  );
}
