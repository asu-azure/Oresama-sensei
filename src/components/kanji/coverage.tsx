// Kanji coverage: overall % learned + per-level progress + a status heatmap of
// every JLPT kanji (learned / seen / unknown). Server-rendered (links only, no
// state). `compact` renders the small Insights card (no heatmap).

import Link from "next/link";
import { kanjiList } from "@/lib/kanji";
import type { KanjiCoverage } from "@/lib/kanji-coverage";
import { cn } from "@/lib/utils";

function LevelBar({
  total,
  learned,
  seen,
}: {
  total: number;
  learned: number;
  seen: number;
}) {
  const learnedPct = total ? (learned / total) * 100 : 0;
  // `seen` already includes learned; the "seen-only" slice sits after learned.
  const seenOnlyPct = total ? ((seen - learned) / total) * 100 : 0;
  return (
    <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full bg-emerald-600" style={{ width: `${learnedPct}%` }} />
      <div className="h-full bg-primary/40" style={{ width: `${seenOnlyPct}%` }} />
    </div>
  );
}

export function KanjiCoverage({
  coverage,
  compact = false,
}: {
  coverage: KanjiCoverage;
  compact?: boolean;
}) {
  const { perLevel, overall } = coverage;

  if (compact) {
    return (
      <Link
        href="/kanji"
        className="block rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-2"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Kanji coverage</h2>
          <span className="text-2xl font-bold tabular-nums">{overall.pct}%</span>
        </div>
        <p className="mt-0.5 text-[11px] text-muted">
          {overall.learned} of {overall.total} JLPT kanji learned →
        </p>
        <div className="mt-3 space-y-1.5">
          {perLevel.map((l) => (
            <div key={l.level} className="flex items-center gap-2 text-xs">
              <span className="w-6 shrink-0 text-muted">{l.level}</span>
              <LevelBar total={l.total} learned={l.learned} seen={l.seen} />
              <span className="w-9 shrink-0 text-right tabular-nums text-muted">
                {l.total ? Math.round((l.learned / l.total) * 100) : 0}%
              </span>
            </div>
          ))}
        </div>
      </Link>
    );
  }

  const learnedSet = new Set(coverage.learned);
  const seenSet = new Set(coverage.seen);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">Kanji coverage</h2>
        <span className="text-sm text-muted">
          <span className="text-2xl font-bold tabular-nums text-foreground">
            {overall.pct}%
          </span>{" "}
          · {overall.learned}/{overall.total} learned · {overall.seen} seen
        </span>
      </div>

      {/* Per-level progress */}
      <div className="mt-4 space-y-2">
        {perLevel.map((l) => (
          <div key={l.level} className="flex items-center gap-3 text-sm">
            <span className="w-7 shrink-0 font-medium">{l.level}</span>
            <LevelBar total={l.total} learned={l.learned} seen={l.seen} />
            <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted">
              {l.learned}/{l.total} ·{" "}
              {l.total ? Math.round((l.learned / l.total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>

      {/* Status heatmap: every kanji, colored by status */}
      <div className="mt-5 space-y-2">
        {perLevel.map((l) => (
          <div key={l.level}>
            <p className="mb-1 text-[11px] font-medium text-muted">{l.level}</p>
            <div className="flex flex-wrap gap-0.5">
              {kanjiList(l.level).map((ch) => {
                const status = learnedSet.has(ch)
                  ? "learned"
                  : seenSet.has(ch)
                    ? "seen"
                    : "unknown";
                return (
                  <Link
                    key={ch}
                    href={`/kanji/${encodeURIComponent(ch)}`}
                    prefetch={false}
                    title={`${ch} · ${status}`}
                    className={cn(
                      "h-3.5 w-3.5 rounded-[3px] transition-transform hover:scale-150",
                      status === "learned"
                        ? "bg-emerald-600"
                        : status === "seen"
                          ? "bg-primary/45"
                          : "bg-surface-2 border border-border",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-600" /> Learned
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-primary/45" /> Seen in a word
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-surface-2" />{" "}
          Not yet
        </span>
      </div>
    </section>
  );
}
