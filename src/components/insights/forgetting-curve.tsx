// Memory-health snapshot + projected forgetting curve. Pure presentational,
// server-renderable (no client hooks): the dashboard computes the numbers from
// FSRS state via `healthBuckets`/`retentionForecast` (src/lib/srs.ts) and passes
// them in. Hand-rolled SVG to match the project's no-charting-lib convention.

import { cn } from "@/lib/utils";
import type { ForecastPoint, HealthBuckets } from "@/lib/srs";

// Horizontal reference lines / y-axis labels. 90% is the FSRS target retention,
// so it's emphasized.
const TICKS = [1, 0.9, 0.75, 0.5, 0.25, 0];

const SEGMENTS: { key: keyof HealthBuckets; label: string; color: string }[] = [
  { key: "strong", label: "Strong", color: "var(--color-emerald-600)" },
  { key: "fading", label: "Fading", color: "var(--color-amber-500)" },
  { key: "weak", label: "Weak", color: "var(--color-accent)" },
  { key: "new", label: "New", color: "var(--color-surface-2)" },
];

const W = 320;
const H = 96;
const PAD = 4;

function forecastPaths(points: ForecastPoint[]) {
  if (points.length < 2) return { line: "", area: "" };
  const maxDay = points[points.length - 1].day || 1;
  const x = (d: number) => PAD + (d / maxDay) * (W - 2 * PAD);
  const y = (r: number) => PAD + (1 - r) * (H - 2 * PAD); // r: 0..1, top = 100%
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)} ${y(p.retention).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(maxDay).toFixed(1)} ${(H - PAD).toFixed(1)} L${PAD} ${(H - PAD).toFixed(1)} Z`;
  return { line, area };
}

export function ForgettingCurve({
  buckets,
  forecast,
}: {
  buckets: HealthBuckets;
  forecast: ForecastPoint[];
}) {
  const reviewed = buckets.strong + buckets.fading + buckets.weak;
  const total = reviewed + buckets.new;

  if (reviewed === 0) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-medium text-muted">Memory strength</h2>
        <p className="text-sm text-muted">
          Once you review some items, this shows how strongly you remember them
          and how that fades over the coming weeks.
        </p>
      </section>
    );
  }

  const { line, area } = forecastPaths(forecast);
  const yPct = (r: number) => PAD + (1 - r) * (H - 2 * PAD);
  // Plain-English caption: average recall a week out if you don't review.
  const day7 = forecast.find((p) => p.day === 7) ?? forecast[forecast.length - 1];
  const recall7 = Math.round(day7.retention * 100);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium text-muted">Memory strength</h2>
        <span className="ml-auto text-[11px] text-muted">
          {reviewed} in review · {total} total
        </span>
      </div>

      {/* Health distribution bar */}
      <div className="flex h-4 overflow-hidden rounded-full bg-surface-2">
        {SEGMENTS.map((s) => {
          const v = buckets[s.key];
          if (v === 0) return null;
          return (
            <div
              key={s.key}
              style={{ width: `${(v / total) * 100}%`, background: s.color }}
              title={`${s.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {SEGMENTS.map((s) => (
          <span key={s.key} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: s.color, outline: s.key === "new" ? "1px solid var(--color-border)" : undefined }}
            />
            {s.label} {buckets[s.key]}
          </span>
        ))}
      </div>

      {/* Projected forgetting curve (next 30 days, no reviews) */}
      <p className="mt-4 mb-1 text-[11px] text-muted">
        If you stop reviewing, average recall drops like this over 30 days:
      </p>
      <div className="flex gap-1.5">
        {/* y-axis labels (HTML, so they don't stretch with the SVG) */}
        <div className="relative h-24 w-8 shrink-0">
          {TICKS.map((r) => (
            <span
              key={r}
              className={cn(
                "absolute right-0 -translate-y-1/2 text-[9px] tabular-nums",
                r === 0.9 ? "font-medium text-foreground" : "text-muted",
              )}
              style={{ top: yPct(r) }}
            >
              {Math.round(r * 100)}%
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-24 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Projected average recall over the next 30 days"
        >
          {/* reference grid; 90% (FSRS target) is dashed + emphasized */}
          {TICKS.map((r) => (
            <line
              key={r}
              x1={PAD}
              x2={W - PAD}
              y1={yPct(r)}
              y2={yPct(r)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={r === 0.9 ? "3 3" : undefined}
              opacity={r === 0.9 ? 1 : 0.45}
            />
          ))}
          <path d={area} fill="var(--color-primary)" opacity={0.12} />
          <path
            d={line}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="ml-[38px] mt-1 flex justify-between text-[10px] text-muted">
        <span>now</span>
        <span>in 2 weeks</span>
        <span>in 30 days</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        Average recall a week from now (without review):{" "}
        <span className="font-medium text-foreground">{recall7}%</span>. Reviewing
        due items resets these toward 100% and stretches the next drop further out.
      </p>
    </section>
  );
}
