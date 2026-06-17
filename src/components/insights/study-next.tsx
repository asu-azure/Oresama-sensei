import Link from "next/link";
import { Target, Brain, Dumbbell, Sparkles, ChevronRight } from "lucide-react";
import type { LearnerInsights, Priority } from "@/lib/insights";
import { strengthColor } from "@/lib/insights";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<Priority["kind"], React.ReactNode> = {
  due: <Brain className="h-4 w-4" />,
  struggling: <Dumbbell className="h-4 w-4" />,
  weak: <Target className="h-4 w-4" />,
  new: <Sparkles className="h-4 w-4" />,
};

/** Deterministic "Study next" card: ranked priorities derived live from SRS
 *  state (zero LLM cost), plus a compact strength read-out by type. */
export function StudyNext({ insights }: { insights: LearnerInsights }) {
  const { priorities, byType } = insights;

  return (
    <section className="pop-card rounded-2xl bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
        <Target className="h-4 w-4 text-primary" /> Study next
      </h2>

      {priorities.length === 0 ? (
        <p className="text-sm text-muted">
          You&apos;re all caught up — nothing urgent. Keep learning to grow your
          collection.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {priorities.map((p) => (
            <li key={p.kind}>
              <Link
                href={p.href}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {KIND_ICON[p.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {p.label}
                </span>
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-muted">
                  {p.count}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {byType.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs text-muted">Retention by type</p>
          <div className="space-y-1.5">
            {byType.map((g) => (
              <div key={g.key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-muted">{g.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${g.masteredPct}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "w-10 shrink-0 text-right text-xs tabular-nums",
                    strengthColor(g.masteredPct),
                  )}
                >
                  {g.masteredPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
