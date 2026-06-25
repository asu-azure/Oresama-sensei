"use client";

/** Tiny pixel "buddies" that amble, sit, and sleep along the bottom edge.
 *  Original art (12×12 grids below) — no external assets, no licensing. Pure-CSS
 *  animation (transform/opacity only); decorative, pointer-events-none, aria-hidden.
 *  Kept animating regardless of OS reduce-motion (owner's decorative-motion choice). */

// '.' transparent · K outline · B body(prop) · E eye · W white · F foot(dark)
const WALK1 = [
  "............",
  "...KKKKKK...",
  "..KBBBBBBK..",
  ".KBBBBBBBBK.",
  ".KBEBBBBEBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  "..KBBBBBBK..",
  "...KKKKKK...",
  "...KK..KK...",
  "..KK....KK..",
];
const WALK2 = [
  "............",
  "...KKKKKK...",
  "..KBBBBBBK..",
  ".KBBBBBBBBK.",
  ".KBEBBBBEBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  "..KBBBBBBK..",
  "...KKKKKK...",
  "....KKKK....",
  "...KK..KK...",
];
const SIT = [
  "............",
  "...KKKKKK...",
  "..KBBBBBBK..",
  ".KBBBBBBBBK.",
  ".KBEBBBBEBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  "..KKKKKKKK..",
  "...K....K...",
];
const SLEEP = [
  "............",
  "............",
  "............",
  "............",
  "..KKKKKKKK..",
  ".KBBBBBBBBK.",
  ".KBKKBBKKBK.",
  ".KBBBBBBBBK.",
  ".KBBBBBBBBK.",
  ".KKKKKKKKKK.",
  "............",
  "............",
];

const OUTLINE = "#0f172a";
function colorFor(ch: string, body: string): string | null {
  switch (ch) {
    case "K":
    case "F":
      return OUTLINE;
    case "B":
      return body;
    case "E":
      return OUTLINE;
    case "W":
      return "#ffffff";
    default:
      return null;
  }
}

function Sprite({
  frame,
  body,
  size,
  style,
  className,
}: {
  frame: string[];
  body: string;
  size: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  const rects: React.ReactNode[] = [];
  frame.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const fill = colorFor(row[x], body);
      if (fill) {
        rects.push(
          <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />,
        );
      }
    }
  });
  return (
    <svg
      viewBox="0 0 12 12"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {rects}
    </svg>
  );
}

export function PixelBuddies() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-0 h-16 overflow-hidden"
    >
      {/* Walker 1 — ambles back and forth */}
      <div
        className="absolute bottom-1 left-0"
        style={{ animation: "buddy-walk 26s ease-in-out infinite" }}
      >
        <div className="relative" style={{ width: 44, height: 44 }}>
          <Sprite frame={WALK1} body="var(--pop-green)" size={44} style={{ position: "absolute", inset: 0 }} />
          <Sprite
            frame={WALK2}
            body="var(--pop-green)"
            size={44}
            style={{ position: "absolute", inset: 0, animation: "buddy-step 0.5s steps(1) infinite" }}
          />
        </div>
      </div>

      {/* Walker 2 — smaller, slower, different color, offset start */}
      <div
        className="absolute bottom-1 left-0 hidden sm:block"
        style={{ animation: "buddy-walk 34s ease-in-out infinite", animationDelay: "-8s" }}
      >
        <div className="relative" style={{ width: 34, height: 34 }}>
          <Sprite frame={WALK1} body="var(--pop-cyan)" size={34} style={{ position: "absolute", inset: 0 }} />
          <Sprite
            frame={WALK2}
            body="var(--pop-cyan)"
            size={34}
            style={{ position: "absolute", inset: 0, animation: "buddy-step 0.6s steps(1) infinite" }}
          />
        </div>
      </div>

      {/* Rester — sits, then sleeps with a zZz, looping */}
      <div className="absolute bottom-1 right-6">
        <div className="relative" style={{ width: 44, height: 44 }}>
          <Sprite frame={SIT} body="var(--pop-pink)" size={44} style={{ position: "absolute", inset: 0 }} />
          <Sprite
            frame={SLEEP}
            body="var(--pop-pink)"
            size={44}
            style={{ position: "absolute", inset: 0, animation: "buddy-rest 11s ease-in-out infinite" }}
          />
          <span
            className="absolute -top-2 right-0 font-bold text-foreground"
            style={{ fontSize: 11, animation: "buddy-zzz 11s ease-in-out infinite" }}
          >
            zZ
          </span>
        </div>
      </div>
    </div>
  );
}
