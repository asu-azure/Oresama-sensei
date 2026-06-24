"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadItemHistory } from "@/app/(app)/library/actions";
import {
  buildSawtooth,
  type ReviewLogRow,
  type Sawtooth,
} from "@/lib/review-history";

const RATING_COLOR: Record<string, string> = {
  again: "var(--color-accent)",
  hard: "var(--color-amber-500)",
  good: "var(--color-primary)",
  easy: "var(--color-emerald-600)",
};

const W = 320;
const H = 100;
const PAD_X = 4;
const PAD_Y = 6;

export function SawtoothChart({ saw }: { saw: Sawtooth }) {
  const span = Math.max(1, saw.t1 - saw.t0);
  const x = (t: number) => PAD_X + ((t - saw.t0) / span) * (W - 2 * PAD_X);
  const y = (r: number) => PAD_Y + (1 - r) * (H - 2 * PAD_Y);

  const line = saw.curve
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)} ${y(p.r).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(saw.t1).toFixed(1)} ${H - PAD_Y} L${PAD_X} ${H - PAD_Y} Z`;

  const fmt = (t: number) =>
    new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-28 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Recall over time for this item"
      >
        {/* 90% reference line */}
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={y(0.9)}
          y2={y(0.9)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path d={area} fill="var(--color-primary)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Review markers (the jump points) */}
        {saw.reviews.map((rv, i) => (
          <circle
            key={i}
            cx={x(rv.t)}
            cy={y(1)}
            r={2.6}
            fill={RATING_COLOR[rv.rating] ?? "var(--color-primary)"}
          >
            <title>{`${fmt(rv.t)} · ${rv.rating}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{fmt(saw.t0)}</span>
        <span>now</span>
      </div>
    </>
  );
}

/** Lazy "Memory history" disclosure for a saved item: on first open it loads the
 *  item's review_log and draws its sawtooth (recall decaying then jumping on each
 *  review). Encourages more reviews until there's enough history to plot. */
export function MemoryHistory({
  itemId,
  reps,
}: {
  itemId: string;
  reps: number | null;
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ReviewLogRow[] | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rows === null && !loading) {
      setLoading(true);
      const data = await loadItemHistory(itemId);
      setRows(data);
      setLoading(false);
    }
  }

  const saw = rows ? buildSawtooth(rows) : null;
  const enough = saw && rows && rows.length >= 2;

  return (
    <div className="mt-2.5 border-t border-border/60 pt-2.5">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Activity className="h-3.5 w-3.5" />
        )}
        Memory history
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {loading ? (
              <p className="mt-2 text-xs text-muted">Loading…</p>
            ) : enough && saw ? (
              <div className="mt-2">
                <SawtoothChart saw={saw} />
                <p className="mt-1 text-[11px] text-muted">
                  Each review snaps your recall back to ~100%, then it fades. As
                  this item gets sturdier the dips get gentler and farther apart.
                </p>
              </div>
            ) : (rows?.length ?? 0) === 1 ? (
              <p className="mt-2 text-xs text-muted">
                One review logged so far — review it once or twice more to see the
                curve build.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted">
                {(reps ?? 0) > 0
                  ? "Your review curve will appear here as you keep practicing this item."
                  : "Review this item a few times and its memory curve will show up here."}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
