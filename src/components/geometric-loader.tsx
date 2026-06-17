/** Reusable on-theme loader: three pop shapes spinning around a center, each
 *  gently pulsing. Pure CSS (transform/opacity only) — cheap and GPU-composited.
 *  Use anywhere we'd otherwise show a plain spinner. */
export function GeometricLoader({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const dot = Math.round(size * 0.3);
  const r = (size - dot) / 2;
  // three shapes at 120° apart on a circle of radius r
  const shapes = [
    { color: "var(--pop-cyan)", round: "9999px", angle: 0 },
    { color: "var(--primary)", round: "2px", angle: 120 },
    { color: "var(--pop-pink)", round: "2px", angle: 240 },
  ];
  return (
    <span
      role="status"
      aria-label="Loading"
      className={className}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        position: "relative",
        animation: "pop-spin 1.4s linear infinite",
      }}
    >
      {shapes.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const cx = size / 2 + r * Math.cos(rad) - dot / 2;
        const cy = size / 2 + r * Math.sin(rad) - dot / 2;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: dot,
              height: dot,
              background: s.color,
              borderRadius: s.round,
              clipPath:
                i === 2 ? "polygon(50% 0%, 100% 100%, 0% 100%)" : undefined,
              animation: "pop-pulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.18}s`,
            }}
          />
        );
      })}
    </span>
  );
}
