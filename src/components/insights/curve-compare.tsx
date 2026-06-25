"use client";

// Compare the ACTUAL review history (sawtooth) of several words: recall snaps to
// ~100% on each review, then decays. Toggle which five (most reviewed / recent /
// difficult) and how to view them — Separate (small multiples, each on its own
// time axis) or Overlay (all on one axis aligned to each word's first review, so
// you compare durability shapes). Pure presentational + useState toggles
// (event-driven, lint-clean). History math reuses buildSawtooth.

import { useState } from "react";
import {
  buildSawtooth,
  type ReviewLogRow,
  type Sawtooth,
} from "@/lib/review-history";
import { SawtoothChart } from "@/components/insights/sawtooth-chart";

export interface CurveItem {
  term: string;
  reading: string | null;
  sub: string; // small caption, e.g. "12 reviews" / "added Jun 20"
  history: ReviewLogRow[]; // this word's review_log rows, chronological
}

export interface CurveLists {
  reviewed: CurveItem[];
  recent: CurveItem[];
  difficult: CurveItem[];
}

type Tab = keyof CurveLists;
type ViewMode = "separate" | "overlay";

const TABS: { key: Tab; label: string }[] = [
  { key: "reviewed", label: "Most reviewed" },
  { key: "recent", label: "Most recent" },
  { key: "difficult", label: "Most difficult" },
];
const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "separate", label: "Separate" },
  { key: "overlay", label: "Overlay" },
];

// Distinct line colors for the overlay — editorial cobalt-family ramp.
const COLORS = [
  "#2742f0",
  "#18c4d6",
  "#e8a31a",
  "#6aa0ff",
  "#9a6bff",
];

const DAY_MS = 86_400_000;
const W = 320;
const H = 150;
const PAD = 4;
const TICKS = [1, 0.9, 0.5, 0];

const yPix = (r: number) => PAD + (1 - r) * (H - 2 * PAD);

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={
            "rounded-md px-2.5 py-1 font-medium transition-colors " +
            (value === o.key
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** All curves on one axis, each aligned to its own first review (x = days since
 *  that word was first reviewed), so decay/recovery shapes are comparable. */
function Overlay({ items }: { items: CurveItem[] }) {
  const built = items
    .map((it) => ({ it, saw: hasTwo(it) ? buildSawtooth(it.history) : null }))
    .filter((b): b is { it: CurveItem; saw: Sawtooth } => b.saw != null);

  if (built.length === 0) {
    return (
      <p className="text-sm text-muted">
        None of these have enough review history yet — keep reviewing and their
        curves will appear here.
      </p>
    );
  }

  const maxSpan = Math.max(
    1,
    ...built.map((b) => b.saw.t1 - b.saw.t0),
  );
  const x = (relMs: number) => PAD + (relMs / maxSpan) * (W - 2 * PAD);
  const maxDays = Math.round(maxSpan / DAY_MS);

  return (
    <div>
      <div className="flex gap-1.5">
        {/* y-axis labels */}
        <div className="relative h-40 w-8 shrink-0">
          {TICKS.map((r) => (
            <span
              key={r}
              className="absolute right-0 -translate-y-1/2 text-[9px] tabular-nums text-muted"
              style={{ top: `${(yPix(r) / H) * 100}%` }}
            >
              {Math.round(r * 100)}%
            </span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-40 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label="Review-history sawtooth curves, aligned to each word's first review"
        >
          {TICKS.map((r) => (
            <line
              key={r}
              x1={PAD}
              x2={W - PAD}
              y1={yPix(r)}
              y2={yPix(r)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              strokeDasharray={r === 0.9 ? "3 3" : undefined}
              opacity={r === 0.9 ? 1 : 0.45}
            />
          ))}
          {built.map((b, i) => {
            const color = COLORS[i % COLORS.length];
            const d = b.saw.curve
              .map(
                (p, j) =>
                  `${j === 0 ? "M" : "L"}${x(p.t - b.saw.t0).toFixed(1)} ${yPix(p.r).toFixed(1)}`,
              )
              .join(" ");
            return (
              <g key={i}>
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {b.saw.reviews.map((rv, k) => (
                  <circle
                    key={k}
                    cx={x(rv.t - b.saw.t0)}
                    cy={yPix(1)}
                    r={2.2}
                    fill={color}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="ml-[38px] mt-1 flex justify-between text-[10px] text-muted">
        <span>first review</span>
        <span>{maxDays}d later →</span>
      </div>
      {/* legend */}
      <ul className="mt-3 space-y-1.5">
        {built.map((b, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span
              className="h-0.5 w-4 shrink-0 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span className="font-jp font-medium">{b.it.term}</span>
            {b.it.reading && (
              <span className="text-xs text-muted">{b.it.reading}</span>
            )}
            <span className="ml-auto shrink-0 text-xs text-muted">
              {b.it.sub}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small multiples: each word's own sawtooth on its own time axis. */
function Separate({ items }: { items: CurveItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((it, i) => {
        const saw = hasTwo(it) ? buildSawtooth(it.history) : null;
        return (
          <div key={i}>
            <div className="mb-1 flex items-center gap-2 text-sm">
              <span className="font-jp font-medium">{it.term}</span>
              {it.reading && (
                <span className="text-xs text-muted">{it.reading}</span>
              )}
              <span className="ml-auto text-xs text-muted">{it.sub}</span>
            </div>
            {saw ? (
              <SawtoothChart saw={saw} />
            ) : (
              <p className="text-xs text-muted">
                Not enough review history yet — review it a couple more times to
                see its curve.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** At least two logged reviews (one isn't enough to draw a decay segment). */
function hasTwo(it: CurveItem): boolean {
  return it.history.length >= 2;
}

export function CurveCompare({ lists }: { lists: CurveLists }) {
  const [tab, setTab] = useState<Tab>("reviewed");
  const [view, setView] = useState<ViewMode>("separate");
  const items = lists[tab].slice(0, 5);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Toggle value={tab} options={TABS} onChange={setTab} />
        <Toggle value={view} options={VIEWS} onChange={setView} />
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">
          Review a few words and their history will plot here.
        </p>
      ) : view === "overlay" ? (
        <Overlay items={items} />
      ) : (
        <Separate items={items} />
      )}
    </div>
  );
}
