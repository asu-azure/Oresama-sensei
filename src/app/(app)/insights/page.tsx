import { Layers, Repeat, PenLine, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/motion/page-heading";
import { Reveal } from "@/components/motion/reveal";
import { Gline, InView, Highlight, FlowText } from "@/components/motion/editorial";
import { fetchAllRows } from "@/lib/fetch-all";
import { masteryLevel } from "@/lib/mastery";
import {
  composition,
  difficultyScatter,
  stabilityBuckets,
  ratingMix,
  hourHistogram,
  passBySource,
  calibration,
  leeches,
  type MiningItem,
  type MiningLog,
} from "@/lib/insights-mining";
import {
  StatCard,
  BarList,
  Scatter,
  HourBars,
  Calibration,
  LeechTable,
} from "@/components/insights/charts";
import {
  CurveCompare,
  type CurveItem,
  type CurveLists,
} from "@/components/insights/curve-compare";
import { loadKanjiCoverage } from "@/lib/kanji-coverage";
import { KanjiCoverage } from "@/components/kanji/coverage";
import type { ReviewLogRow } from "@/lib/review-history";

// Columns needed to mine every chart (kept tight; id is required to join reviews
// back to their source_type).
const ITEM_COLUMNS =
  "id,type,term,reading,jlpt_level,source_type,created_at,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval";
const LOG_COLUMNS =
  "item_id,rating,reviewed_at,elapsed_days,retrievability,stability_after";

type ItemRow = MiningItem & { id: string; created_at: string };

// Short month-day label, e.g. "Jun 20".
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Build the three top-5 lists for the review-history comparison. Each item
 *  carries its own review_log rows (grouped from the already-fetched logs) so the
 *  client can draw its sawtooth — no extra query. */
function buildCurveLists(
  items: ItemRow[],
  historyByItem: Map<string, ReviewLogRow[]>,
): CurveLists {
  const toCurve = (it: ItemRow, sub: string): CurveItem => ({
    term: it.term,
    reading: it.reading,
    sub,
    history: historyByItem.get(it.id) ?? [],
  });
  const reviewed = [...items]
    .filter((it) => (it.srs_reps ?? 0) > 0)
    .sort((a, b) => (b.srs_reps ?? 0) - (a.srs_reps ?? 0))
    .slice(0, 5)
    .map((it) => toCurve(it, `${it.srs_reps ?? 0} reviews`));
  const recent = [...items]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map((it) => toCurve(it, `added ${shortDate(it.created_at)}`));
  const difficult = [...items]
    .filter((it) => (it.srs_reps ?? 0) > 0 && it.srs_difficulty != null)
    .sort((a, b) => (b.srs_difficulty ?? 0) - (a.srs_difficulty ?? 0))
    .slice(0, 5)
    .map((it) => toCurve(it, `diff ${(it.srs_difficulty ?? 0).toFixed(1)}`));
  return { reviewed, recent, difficult };
}

/** Group the flat review_log rows by item_id into chronological ReviewLogRow[]
 *  arrays (buildSawtooth-ready). Only reviewed_at/rating/stability_after are used
 *  by the sawtooth; the rest are filled with nulls. */
function groupHistory(logs: MiningLog[]): Map<string, ReviewLogRow[]> {
  const m = new Map<string, ReviewLogRow[]>();
  for (const l of logs) {
    const row: ReviewLogRow = {
      reviewed_at: l.reviewed_at,
      rating: l.rating,
      elapsed_days: l.elapsed_days,
      retrievability: l.retrievability,
      stability_before: null,
      stability_after: l.stability_after ?? 1,
      interval_after: null,
    };
    (m.get(l.item_id) ?? m.set(l.item_id, []).get(l.item_id)!).push(row);
  }
  // logs are already fetched ordered by reviewed_at asc, so groups stay ordered.
  return m;
}

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pop-card rounded-2xl bg-surface p-5">
      <Reveal as="h2" className="serif text-lg font-medium">
        {title}
      </Reveal>
      <Gline className="mb-3 mt-2" />
      {caption && <p className="mb-3 text-xs text-muted">{caption}</p>}
      <InView className={caption ? "" : "mt-3"}>{children}</InView>
    </section>
  );
}

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [items, logs, kanjiCoverage, [{ count: learnedKanji }, { count: lessonCount }]] =
    await Promise.all([
      fetchAllRows<ItemRow>((from, to) =>
        supabase
          .from("knowledge_items")
          .select(ITEM_COLUMNS)
          .eq("user_id", user!.id)
          .order("id")
          .range(from, to),
      ),
      // review_log degrades to [] if migration 0022 hasn't been run.
      fetchAllRows<MiningLog>((from, to) =>
        supabase
          .from("review_log")
          .select(LOG_COLUMNS)
          .eq("user_id", user!.id)
          .order("reviewed_at", { ascending: true })
          .range(from, to),
      ),
      loadKanjiCoverage(supabase, user!.id),
      Promise.all([
        supabase
          .from("kanji")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("learned", true),
        supabase
          .from("lessons")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
      ]),
    ]);

  if (items.length === 0) {
    return (
      <div className="space-y-6 py-4">
        <h1 className="text-xl font-semibold">Insights</h1>
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-sm text-muted">
          Insights appear here once you&apos;ve saved some vocab and reviewed it.
        </div>
      </div>
    );
  }

  // ---- Mine everything (pure, no DB) ----
  const { bySource, byLevel, byType } = composition(items);
  const scatter = difficultyScatter(items);
  const maturity = stabilityBuckets(items);
  const ratings = ratingMix(logs);
  const hours = hourHistogram(logs);
  const sourceById = new Map(items.map((it) => [it.id, it.source_type]));
  const sourcePass = passBySource(sourceById, logs);
  const calib = calibration(logs);
  const leechRows = leeches(items);
  const curveLists = buildCurveLists(items, groupHistory(logs));

  // Headline numbers.
  const mastered = items.filter(
    (it) => masteryLevel(it).level === "mastered",
  ).length;
  const masteredPct = Math.round((mastered / items.length) * 100);
  const peakHour = hours.reduce((a, b) => (b.count > a.count ? b : a), hours[0]);
  const easyPct =
    logs.length > 0
      ? Math.round(
          (logs.filter((l) => l.rating === "easy").length / logs.length) * 100,
        )
      : 0;

  return (
    <div className="space-y-6 py-4">
      <PageHeading
        kicker="LEARNING SCIENCE — VISUALIZED"
        title="Insights"
        jp="洞察"
        vtext="学びの記録"
        flow
        subtitle="Data-mined from your saved words and review history."
      />

      {/* Editorial intro — the signature highlight-box sweep + flowing wordmark */}
      <div className="py-2">
        <Reveal as="p" className="max-w-2xl text-lg leading-relaxed sm:text-xl">
          <span>
            Drawn from every word you&apos;ve saved and every review you&apos;ve
            logged — what&apos;s <Highlight variant="cyan">solid</Highlight>,
            what&apos;s <Highlight variant="amber">slipping</Highlight>, and when
            to come back.
          </span>
        </Reveal>
        <p className="mono mt-8">THE NUMBERS BELOW MEASURE</p>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
          <FlowText as="div" className="mega leading-none">
            MEMORY
          </FlowText>
          <span
            className="flow-text text-5xl font-semibold leading-none sm:text-6xl"
            style={{ fontFamily: "var(--font-serif-jp)" }}
          >
            記憶
          </span>
        </div>
      </div>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Items"
          value={items.length}
          sub={`${mastered} mastered (${masteredPct}%)`}
        />
        <StatCard
          icon={<Repeat className="h-4 w-4" />}
          label="Reviews logged"
          value={logs.length}
          sub={logs.length ? `${easyPct}% rated easy` : "start reviewing"}
        />
        <StatCard
          icon={<PenLine className="h-4 w-4" />}
          label="Kanji learned"
          value={learnedKanji ?? 0}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Lessons"
          value={lessonCount ?? 0}
        />
      </div>

      {/* Composition */}
      <Section
        title="Where your words come from"
        caption="Every saved item by its source. Books dominate; words met in isolation (kanji drills, SNS) are a smaller slice."
      >
        <BarList data={bySource} />
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          title="By JLPT level"
          caption="Your collection is centered on one level."
        >
          <BarList data={byLevel} colorVar="var(--color-accent)" />
        </Section>
        <Section title="By type" caption="Vocabulary vs grammar vs set phrases.">
          <BarList data={byType} />
        </Section>
      </div>

      {/* Kanji coverage (compact card → full view on /kanji) */}
      <KanjiCoverage coverage={kanjiCoverage} compact />

      {/* Difficulty vs stability — the standout */}
      <Section
        title="Difficulty vs memory strength"
        caption="Each dot is a reviewed word: how hard it feels (up = harder) against how long you'll remember it (right = more durable). The healthy diagonal — hard, fragile words gather top-left, mastered words drift bottom-right — is exactly what FSRS predicts."
      >
        <Scatter points={scatter} />
      </Section>

      {/* Maturity buckets */}
      <Section
        title="Memory maturity"
        caption="How durable each item is, by FSRS stability (days until recall fades to ~90%)."
      >
        <BarList data={maturity} colorVar="var(--color-emerald-600)" />
      </Section>

      {/* Top-5 review-history (sawtooth) comparison */}
      <Section
        title="Compare review history"
        caption="Each word's real review history: recall snaps back to ~100% on every review, then fades. Switch which five (and Separate vs Overlay — overlaid curves align to each word's first review so you can compare durability)."
      >
        <CurveCompare lists={curveLists} />
      </Section>

      {/* Review behavior */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="How your reviews go"
          caption="Self-rating mix across every logged review."
        >
          {ratings.length ? (
            <BarList data={ratings} />
          ) : (
            <p className="text-sm text-muted">
              No reviews logged yet — grade some flashcards and this fills in.
            </p>
          )}
        </Section>
        <Section
          title="Study rhythm"
          caption={`Reviews by hour, local time (UTC+7).${
            logs.length
              ? ` Your peak is ${String(peakHour.hour).padStart(2, "0")}:00.`
              : ""
          }`}
        >
          {logs.length ? (
            <HourBars data={hours} />
          ) : (
            <p className="text-sm text-muted">
              Your daily study rhythm will show here once you review.
            </p>
          )}
        </Section>
      </div>

      {/* Source quality */}
      <Section
        title="Which sources actually stick"
        caption="Pass rate (rated Good or Easy) per source, for sources with enough reviews. Words you meet in rich context tend to outlast words drilled in isolation."
      >
        {sourcePass.length ? (
          <div className="space-y-3">
            {sourcePass.map((s) => (
              <div key={s.label} className="text-sm">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-muted" title={s.label}>
                    {s.label}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {s.passPct}% pass · {s.againPct}% again · {s.reviews} reviews
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${s.passPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Once each source has a handful of reviews, this compares how well they
            stick.
          </p>
        )}
      </Section>

      {/* Calibration */}
      <Section
        title="Is the scheduler calibrated to you?"
        caption="What FSRS predicted you'd recall vs what you actually did, by how long it had been. A persistent gap means the scheduler runs optimistic (or pessimistic) for you. Early data — sharpens as history grows."
      >
        <Calibration data={calib} />
      </Section>

      {/* Leeches */}
      <Section
        title="Your toughest words"
        caption="The leeches — most lapses first, then hardest. These are worth a custom mnemonic or an Ask Sensei deep-dive."
      >
        <LeechTable items={leechRows} />
      </Section>
    </div>
  );
}
