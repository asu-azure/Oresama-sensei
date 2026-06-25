// Hand-rolled, server-renderable chart primitives for the /insights page. No
// charting library (project convention), no "use client" — data is static given
// props, so these stay server components and dodge the set-state-in-effect lint
// rule. Colors are all var(--color-*) tokens so dark mode just works.

import type { MasteryLevel } from "@/lib/mastery";
import type {
  Bar,
  CalibrationPoint,
  Leech,
  ScatterPoint,
} from "@/lib/insights-mining";

// ---- Stat cards ------------------------------------------------------------

export function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="pop-card rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

// ---- Generic horizontal bar list ------------------------------------------

export function BarList({
  data,
  colorVar = "var(--color-primary)",
  showValue = true,
}: {
  data: Bar[];
  colorVar?: string;
  showValue?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-28 shrink-0 truncate text-muted" title={d.label}>
            {d.label}
          </span>
          <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="bar-grow h-full origin-left rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.colorVar ?? colorVar,
                "--i": i,
              } as React.CSSProperties}
            />
          </div>
          {showValue && (
            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
              {d.value}
              {d.sub ? ` · ${d.sub}` : ""}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Difficulty vs stability scatter --------------------------------------

const MASTERY_FILL: Record<MasteryLevel, string> = {
  new: "var(--color-zinc-400)",
  struggling: "var(--color-accent)",
  learning: "var(--color-amber-500)",
  young: "var(--color-blue-500)",
  mastered: "var(--color-emerald-600)",
};
const MASTERY_LEGEND: { level: MasteryLevel; label: string }[] = [
  { level: "struggling", label: "Struggling" },
  { level: "learning", label: "Learning" },
  { level: "young", label: "Young" },
  { level: "mastered", label: "Mastered" },
];

const SC_W = 320;
const SC_H = 200;
const SC_PAD = 6;

/** difficulty (y, 1..10) vs stability (x, log scale for the long tail). */
export function Scatter({ points }: { points: ScatterPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted">
        Once you&apos;ve reviewed some items this maps each word by how hard it
        feels vs how durably you remember it.
      </p>
    );
  }
  const maxStab = Math.max(1, ...points.map((p) => p.x));
  const lx = (s: number) => Math.log10(s + 1) / Math.log10(maxStab + 1); // 0..1
  const px = (s: number) => SC_PAD + lx(s) * (SC_W - 2 * SC_PAD);
  const py = (d: number) => SC_PAD + (1 - (d - 1) / 9) * (SC_H - 2 * SC_PAD); // 1..10, hard at top

  // X gridlines at memorable stabilities within range.
  const xTicks = [1, 7, 30, 90, 365].filter((t) => t <= maxStab);

  return (
    <div>
      <div className="flex gap-1.5">
        {/* y-axis labels (difficulty) */}
        <div className="relative h-52 w-12 shrink-0 text-[9px] text-muted">
          <span className="absolute right-0 top-0">hard 10</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">5</span>
          <span className="absolute bottom-0 right-0">easy 1</span>
        </div>
        <div className="relative h-52 w-full">
        <svg
          viewBox={`0 0 ${SC_W} ${SC_H}`}
          className="h-52 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Difficulty versus memory stability for each reviewed item"
        >
          {/* horizontal grid */}
          {[1, 4, 7, 10].map((d) => (
            <line
              key={d}
              x1={SC_PAD}
              x2={SC_W - SC_PAD}
              y1={py(d)}
              y2={py(d)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.5}
            />
          ))}
          {/* vertical grid at memorable day marks */}
          {xTicks.map((t) => (
            <line
              key={t}
              x1={px(t)}
              x2={px(t)}
              y1={SC_PAD}
              y2={SC_H - SC_PAD}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={0.5}
            />
          ))}
          {points.map((p, i) => (
            <circle
              key={i}
              className="spark"
              style={
                {
                  "--i": i % 60,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                } as React.CSSProperties
              }
              cx={px(p.x)}
              cy={py(p.y)}
              r={3}
              fill={MASTERY_FILL[p.level]}
              fillOpacity={0.7}
            >
              <title>{`${p.term} · difficulty ${p.y.toFixed(1)} · stability ${p.x.toFixed(1)}d`}</title>
            </circle>
          ))}
        </svg>
        {/* corner hints (HTML overlay, so they don't stretch with the SVG) */}
        <span className="pointer-events-none absolute left-1 top-0.5 text-[9px] text-muted opacity-70">
          hard · fragile
        </span>
        <span className="pointer-events-none absolute bottom-0.5 right-1 text-[9px] text-muted opacity-70">
          easy · durable
        </span>
        </div>
      </div>
      {/* x-axis labels */}
      <div className="ml-[54px] mt-1 flex justify-between text-[10px] text-muted">
        <span>1d</span>
        <span>stability (days, log) →</span>
        <span>{Math.round(maxStab)}d</span>
      </div>
      {/* legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        {MASTERY_LEGEND.map((m) => (
          <span key={m.level} className="flex items-center gap-1">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: MASTERY_FILL[m.level] }}
            />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---- Reviews by hour-of-day ------------------------------------------------

export function HourBars({
  data,
}: {
  data: { hour: number; count: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const peak = data.reduce((a, b) => (b.count > a.count ? b : a), data[0]);
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5 overflow-hidden">
        {data.map((d, i) => (
          <div
            key={d.hour}
            className="flex h-full min-w-0 flex-1 flex-col items-center justify-end"
            title={`${String(d.hour).padStart(2, "0")}:00 — ${d.count} reviews`}
          >
            <div
              className="bar-rise w-full origin-bottom rounded-t bg-primary"
              style={{
                height: `${Math.max(d.count > 0 ? 4 : 0, (d.count / max) * 100)}%`,
                opacity: d.hour === peak.hour ? 1 : 0.55,
                "--i": i,
              } as React.CSSProperties}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
    </div>
  );
}

// ---- Model calibration: predicted vs actual recall ------------------------

export function Calibration({ data }: { data: CalibrationPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        As your review history grows, this compares what the scheduler predicted
        you&apos;d remember against what you actually did.
      </p>
    );
  }
  return (
    <div>
      <div className="flex h-36 items-end gap-2 overflow-hidden">
        {data.map((d, i) => (
          <div
            key={d.label}
            className="flex h-full min-w-0 flex-1 flex-col items-center gap-1"
            title={`${d.label}: predicted ${d.predictedPct}% · actual ${d.actualPct}% (n=${d.n})`}
          >
            <div className="flex w-full flex-1 items-end justify-center gap-0.5">
              <div
                className="bar-rise w-1/2 origin-bottom rounded-t bg-blue-500/70"
                style={
                  { height: `${Math.max(2, d.predictedPct)}%`, "--i": i * 2 } as React.CSSProperties
                }
              />
              <div
                className="bar-rise w-1/2 origin-bottom rounded-t bg-primary/80"
                style={
                  { height: `${Math.max(2, d.actualPct)}%`, "--i": i * 2 + 1 } as React.CSSProperties
                }
              />
            </div>
            <span className="h-3 w-full truncate text-center text-[9px] leading-3 text-muted">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-blue-500/70" /> FSRS predicted
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-primary/80" /> you actually
          recalled
        </span>
      </div>
    </div>
  );
}

// ---- Leech table -----------------------------------------------------------

export function LeechTable({ items }: { items: Leech[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        No problem words yet — nothing has lapsed or scored as very hard. Nice.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="pb-2 font-medium">Word</th>
            <th className="pb-2 text-center font-medium">Lapses</th>
            <th className="pb-2 text-center font-medium">Difficulty</th>
            <th className="pb-2 text-center font-medium">Stability</th>
            <th className="hidden pb-2 text-right font-medium sm:table-cell">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-t border-border">
              <td className="py-2 pr-2">
                <span className="font-jp font-medium">{it.term}</span>
                {it.reading && (
                  <span className="ml-2 text-xs text-muted">{it.reading}</span>
                )}
                <span className="ml-2 text-[10px] text-muted">{it.level}</span>
              </td>
              <td className="py-2 text-center tabular-nums">
                {it.lapses > 0 ? (
                  <span className="font-medium text-accent">{it.lapses}</span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="py-2 text-center tabular-nums">{it.difficulty}</td>
              <td className="py-2 text-center tabular-nums text-muted">
                {it.stability}d
              </td>
              <td className="hidden py-2 text-right text-xs text-muted sm:table-cell">
                {it.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
