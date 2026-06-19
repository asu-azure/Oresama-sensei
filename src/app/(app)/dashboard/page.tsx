import Link from "next/link";
import { BookOpen, Brain, MessageCircle, Layers } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { computeInsights, type InsightItem } from "@/lib/insights";
import { StudyNext } from "@/components/insights/study-next";
import {
  CoachNote,
  type CoachNoteData,
} from "@/components/insights/coach-note";

type Item = {
  type: string;
  jlpt_level: string | null;
  created_at: string;
  times_seen: number;
  srs_due: string | null;
  srs_reps: number;
  srs_lapses: number | null;
  srs_stability: number | null;
  srs_difficulty: number | null;
  srs_interval: number | null;
  srs_last_review: string | null;
  term: string;
  reading: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  vocab: "Vocabulary",
  grammar: "Grammar",
  expression: "Expressions",
};

function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <div className="pop-card rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition-colors hover:opacity-80">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Bars({
  data,
  colorVar = "var(--color-primary)",
}: {
  data: { label: string; value: number }[];
  colorVar?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-24 shrink-0 text-muted">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: colorVar,
              }}
            />
          </div>
          <span className="w-8 shrink-0 text-right tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nowMs = new Date().getTime();
  const [
    { data: itemsRaw },
    { data: lessonsRaw },
    { count: questionCount },
    { data: coachRow },
  ] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(
        "type,jlpt_level,created_at,times_seen,srs_due,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval,srs_last_review,term,reading",
      )
      .eq("user_id", user!.id),
    supabase.from("lessons").select("kind").eq("user_id", user!.id),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .eq("role", "user"),
    supabase
      .from("learner_insights")
      .select("summary_md,focus_areas,generated_at")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const items = (itemsRaw ?? []) as Item[];
  const lessons = (lessonsRaw ?? []) as { kind: string }[];
  const insights = computeInsights(items as InsightItem[], new Date(nowMs));
  const coachInitial = (coachRow as CoachNoteData | null) ?? null;

  const dueNow = items.filter(
    (i) => !i.srs_due || new Date(i.srs_due).getTime() <= nowMs,
  ).length;

  const byType = (["vocab", "grammar", "expression"] as const).map((t) => ({
    label: TYPE_LABEL[t],
    value: items.filter((i) => i.type === t).length,
  }));

  const levels = ["N1", "N2", "N3"];
  const byLevel = [
    ...levels.map((lv) => ({
      label: lv,
      value: items.filter((i) => (i.jlpt_level ?? "").toUpperCase() === lv)
        .length,
    })),
    {
      label: "Other",
      value: items.filter(
        (i) => !levels.includes((i.jlpt_level ?? "").toUpperCase()),
      ).length,
    },
  ];

  // Activity per day, last 14 days: items ADDED and items REVIEWED. Reviewing
  // keeps the chart alive on days you didn't add anything new.
  const addedByDay: Record<string, number> = {};
  const reviewedByDay: Record<string, number> = {};
  for (const i of items) {
    addedByDay[i.created_at.slice(0, 10)] =
      (addedByDay[i.created_at.slice(0, 10)] ?? 0) + 1;
    if (i.srs_last_review) {
      const k = i.srs_last_review.slice(0, 10);
      reviewedByDay[k] = (reviewedByDay[k] ?? 0) + 1;
    }
  }
  const days: { label: string; added: number; reviewed: number }[] = [];
  for (let d = 13; d >= 0; d--) {
    const key = new Date(nowMs - d * 86_400_000).toISOString().slice(0, 10);
    days.push({
      label: d === 0 ? "Today" : key.slice(5),
      added: addedByDay[key] ?? 0,
      reviewed: reviewedByDay[key] ?? 0,
    });
  }
  const activityTotal = days.reduce((s, d) => s + d.added + d.reviewed, 0);

  const topSeen = [...items]
    .sort((a, b) => b.times_seen - a.times_seen)
    .slice(0, 8);

  const photoCount = lessons.filter((l) => l.kind !== "summary").length;
  const summaryCount = lessons.filter((l) => l.kind === "summary").length;
  const scheduled = items.filter((i) => i.srs_reps > 0).length;

  return (
    <div className="space-y-6 py-4">
      <h1 className="text-xl font-semibold">Progress</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Items learned"
          value={items.length}
        />
        <StatCard
          icon={<Brain className="h-4 w-4" />}
          label="Due to review"
          value={dueNow}
          href="/review"
        />
        <StatCard
          icon={<BookOpen className="h-4 w-4" />}
          label="Lessons"
          value={photoCount + summaryCount}
          href="/lessons"
        />
        <StatCard
          icon={<MessageCircle className="h-4 w-4" />}
          label="Questions asked"
          value={questionCount ?? 0}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          Your stats will fill in as you chat and make lessons.
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <StudyNext insights={insights} />
            <CoachNote initial={coachInitial} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-medium text-muted">By type</h2>
              <Bars data={byType} />
            </section>
            <section className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-medium text-muted">
                By JLPT level
              </h2>
              <Bars data={byLevel} colorVar="var(--color-accent)" />
            </section>
          </div>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-sm font-medium text-muted">
                Activity · last 14 days
              </h2>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-sm bg-primary/80" /> added
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-sm bg-emerald-500/80" /> reviewed
              </span>
              <span className="ml-auto text-[11px] text-muted">
                {scheduled} in review rotation
              </span>
            </div>
            {activityTotal === 0 ? (
              <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-muted">
                <p>No study activity in the last 14 days.</p>
                {dueNow > 0 ? (
                  <Link
                    href="/review"
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Review {dueNow} due →
                  </Link>
                ) : (
                  <Link
                    href="/chat"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-2"
                  >
                    Study something new →
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex h-32 items-end gap-1">
                {days.map((d, i) => {
                  const max = Math.max(
                    1,
                    ...days.map((x) => Math.max(x.added, x.reviewed)),
                  );
                  return (
                    <div
                      key={i}
                      className="flex h-full flex-1 flex-col items-center gap-1"
                      title={`${d.label}: ${d.added} added, ${d.reviewed} reviewed`}
                    >
                      <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                        <div
                          className="w-1/2 rounded-t bg-primary/80"
                          style={{
                            height: `${Math.max(d.added > 0 ? 6 : 0, (d.added / max) * 100)}%`,
                          }}
                        />
                        <div
                          className="w-1/2 rounded-t bg-emerald-500/80"
                          style={{
                            height: `${Math.max(d.reviewed > 0 ? 6 : 0, (d.reviewed / max) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-muted">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-medium text-muted">
              Most revisited
            </h2>
            <ul className="space-y-1.5">
              {topSeen.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-jp">
                    {it.term}
                    {it.reading && (
                      <span className="ml-2 text-muted">{it.reading}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted">{it.times_seen}×</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
