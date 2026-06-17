"use client";

/** Decorative floating shapes — NicoNico MV-style pop-art layer.
 *  Fixed behind all content, pointer-events-none, aria-hidden.
 *  Animations use transform+opacity only → GPU-composited, zero CPU cost.
 */
export function BackgroundParticles() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Large faint circle — center background glow */}
      <div
        className="pop-particle absolute rounded-full"
        style={{
          width: 260,
          height: 260,
          top: "30%",
          left: "50%",
          marginLeft: -130,
          background: "var(--pop-green)",
          opacity: 0.05,
          animation: "pop-pulse 8s ease-in-out infinite",
          animationDelay: "0s",
        }}
      />

      {/* Top-right circle */}
      <div
        className="pop-particle absolute rounded-full"
        style={{
          width: 80,
          height: 80,
          top: "6%",
          right: "8%",
          background: "var(--pop-cyan)",
          opacity: 0.09,
          animation: "pop-float 6s ease-in-out infinite",
          animationDelay: "0.5s",
        }}
      />

      {/* Top-left cross / plus shape */}
      <div
        className="pop-particle absolute"
        style={{
          width: 44,
          height: 44,
          top: "12%",
          left: "7%",
          opacity: 0.11,
          animation: "pop-float-x 7s ease-in-out infinite",
          animationDelay: "1.2s",
        }}
      >
        <svg viewBox="0 0 44 44" fill="var(--pop-cyan)">
          <rect x="18" y="2" width="8" height="40" rx="3" />
          <rect x="2" y="18" width="40" height="8" rx="3" />
        </svg>
      </div>

      {/* Mid-left square */}
      <div
        className="pop-particle absolute hidden sm:block"
        style={{
          width: 36,
          height: 36,
          top: "42%",
          left: "3%",
          background: "var(--pop-pink)",
          opacity: 0.10,
          animation: "pop-spin 8s linear infinite",
          animationDelay: "0.3s",
        }}
      />

      {/* Mid-right small circle */}
      <div
        className="pop-particle absolute hidden sm:block rounded-full"
        style={{
          width: 20,
          height: 20,
          top: "55%",
          right: "5%",
          background: "var(--pop-orange)",
          opacity: 0.12,
          animation: "pop-pulse 4s ease-in-out infinite",
          animationDelay: "0.8s",
        }}
      />

      {/* Bottom-left spinning square */}
      <div
        className="pop-particle absolute"
        style={{
          width: 24,
          height: 24,
          bottom: "14%",
          left: "6%",
          background: "var(--pop-purple)",
          opacity: 0.10,
          animation: "pop-spin-rev 9s linear infinite",
          animationDelay: "2s",
        }}
      />

      {/* Bottom-right diamond */}
      <div
        className="pop-particle absolute hidden sm:block"
        style={{
          width: 28,
          height: 28,
          bottom: "18%",
          right: "10%",
          background: "var(--pop-yellow)",
          opacity: 0.12,
          transform: "rotate(45deg)",
          animation: "pop-drift 10s ease-in-out infinite",
          animationDelay: "1.5s",
        }}
      />

      {/* Top-center horizontal line */}
      <div
        className="pop-particle absolute hidden sm:block rounded-full"
        style={{
          width: 60,
          height: 5,
          top: "22%",
          left: "50%",
          marginLeft: -30,
          background: "var(--pop-green)",
          opacity: 0.10,
          animation: "pop-float 5s ease-in-out infinite",
          animationDelay: "0.9s",
        }}
      />

      {/* Small dot cluster — lower mid */}
      <div
        className="pop-particle absolute rounded-full"
        style={{
          width: 14,
          height: 14,
          top: "68%",
          left: "22%",
          background: "var(--pop-pink)",
          opacity: 0.12,
          animation: "pop-pulse 3s ease-in-out infinite",
          animationDelay: "0.4s",
        }}
      />

      {/* Upper-mid-right triangle */}
      <div
        className="pop-particle absolute hidden sm:block"
        style={{
          width: 32,
          height: 32,
          top: "28%",
          right: "18%",
          opacity: 0.09,
          animation: "pop-drift 12s ease-in-out infinite",
          animationDelay: "3s",
        }}
      >
        <svg viewBox="0 0 32 32" fill="var(--pop-cyan)">
          <polygon points="16,2 30,30 2,30" />
        </svg>
      </div>

      {/* Near-bottom-right plus */}
      <div
        className="pop-particle absolute"
        style={{
          width: 18,
          height: 18,
          bottom: "8%",
          right: "22%",
          opacity: 0.11,
          animation: "pop-spin 6s linear infinite",
          animationDelay: "1.8s",
        }}
      >
        <svg viewBox="0 0 18 18" fill="var(--pop-orange)">
          <rect x="7" y="1" width="4" height="16" rx="1.5" />
          <rect x="1" y="7" width="16" height="4" rx="1.5" />
        </svg>
      </div>

      {/* Near-top-left diamond */}
      <div
        className="pop-particle absolute hidden sm:block"
        style={{
          width: 22,
          height: 22,
          top: "5%",
          left: "28%",
          background: "var(--pop-purple)",
          opacity: 0.10,
          transform: "rotate(45deg)",
          animation: "pop-float-x 9s ease-in-out infinite",
          animationDelay: "2.5s",
        }}
      />
    </div>
  );
}
