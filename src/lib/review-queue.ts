import type { SupabaseClient } from "@supabase/supabase-js";
import { startOfStudyDay, studyDayKey, nextStudyDayStart } from "./study-day";
import type { StudyPace } from "./pace";

// Builds the day's review queue.
//
// New words (srs_reps = 0) and due reviews are separate buckets, each with its
// own daily budget. Work already done today is measured from review_log, and
// whatever is left over is reported as a backlog with an honest "days at this
// pace" estimate rather than a scary uncapped badge.
//
// Nothing rewrites srs_due. FSRS handles late reviews correctly on its own; the
// only real problem was which cards get shown and what number gets displayed.
// (See "Decisions" in CLAUDE.md for why there is no bulk postpone and no streak.)

const DAY_MS = 86_400_000;

/** How many review candidates to pull before sorting by relative overdueness.
 *  See the note in buildQueue for why this bound is safe. */
const CANDIDATE_CAP = 600;

/** Ids per .in() request, so a large budget cannot overflow the URL length. */
const IN_CHUNK = 150;

interface ReviewCandidate {
  id: string;
  srs_due: string | null;
  srs_interval: number | null;
}

export interface TodayLoad {
  dayStartIso: string;
  dayKey: string;
  nextResetIso: string;
  pace: StudyPace;
  /** Work already logged today (review_log rows since the study-day start). */
  doneToday: { total: number; newCards: number; reviews: number };
  /** Budget left today. */
  remaining: { newCards: number; reviews: number };
  /** The true pile, uncapped — shown as context, never as the headline number. */
  backlog: { newCards: number; reviews: number };
  /** What the learner actually has left to do today. This is the badge number. */
  plannedToday: { newCards: number; reviews: number; total: number };
  /** Rough days to clear the review backlog at the current pace. */
  daysToClear: number;
}

export interface QueuePlan extends TodayLoad {
  /** Item ids in the order they should be studied. */
  ids: string[];
  plan: { newCards: number; reviews: number };
}

/** "Due": NULL counts as due, so a row can never fall out of both buckets. */
function dueFilter(nowIso: string): string {
  return ["srs_due.is.null", "srs_due.lte." + nowIso].join(",");
}

// --- counts ------------------------------------------------------------------

/** Today's budget picture. Four indexed head-only counts; no rows are moved. */
export async function getTodayLoad(
  supabase: SupabaseClient,
  userId: string,
  pace: StudyPace,
  now: Date = new Date(),
): Promise<TodayLoad> {
  const dayStart = startOfStudyDay(now, pace.timeZone, pace.dayStartHour);
  const dayStartIso = dayStart.toISOString();
  const nowIso = now.toISOString();

  const [doneTotalRes, doneNewRes, backNewRes, backRevRes] = await Promise.all([
    supabase
      .from("review_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", dayStartIso),
    // stability_before IS NULL marks the first-ever FSRS review of a card
    // (grading writes `srs_stability ?? null`, and srs_stability is only null
    // before a card has ever been scheduled). So this is an exact count of NEW
    // cards introduced today, needing no extra column.
    supabase
      .from("review_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("reviewed_at", dayStartIso)
      .is("stability_before", null),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("srs_reps", 0)
      .eq("srs_suspended", false),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gt("srs_reps", 0)
      .eq("srs_suspended", false)
      .or(dueFilter(nowIso)),
  ]);
  for (const r of [doneTotalRes, doneNewRes, backNewRes, backRevRes]) {
    if (r.error) throw r.error;
  }

  const total = doneTotalRes.count ?? 0;
  const newCards = doneNewRes.count ?? 0;
  const reviews = Math.max(0, total - newCards);

  const backlog = {
    newCards: backNewRes.count ?? 0,
    reviews: backRevRes.count ?? 0,
  };
  const remaining = {
    newCards: Math.max(0, pace.newLimit - newCards),
    reviews: Math.max(0, pace.reviewLimit - reviews),
  };
  const plannedNew = Math.min(remaining.newCards, backlog.newCards);
  const plannedRev = Math.min(remaining.reviews, backlog.reviews);

  return {
    dayStartIso,
    dayKey: studyDayKey(now, pace.timeZone, pace.dayStartHour),
    nextResetIso: nextStudyDayStart(now, pace.timeZone, pace.dayStartHour).toISOString(),
    pace,
    doneToday: { total, newCards, reviews },
    remaining,
    backlog,
    plannedToday: {
      newCards: plannedNew,
      reviews: plannedRev,
      total: plannedNew + plannedRev,
    },
    daysToClear: Math.ceil(backlog.reviews / Math.max(1, pace.reviewLimit)),
  };
}

// --- ordering ----------------------------------------------------------------

/** How overdue a card is RELATIVE to how long it was meant to wait.
 *
 *  A 1-day-interval card three days late has decayed far more than a
 *  200-day-interval card three days late, so draining a backlog in this order
 *  preserves the most memory. Plain srs_due ASC does close to the opposite. */
export function overdueRatio(
  row: { srs_due: string | null; srs_interval: number | null },
  nowMs: number,
): number {
  if (!row.srs_due) return Number.POSITIVE_INFINITY; // never scheduled → first
  const lateMs = nowMs - Date.parse(row.srs_due);
  const windowMs = Math.max(DAY_MS, (row.srs_interval ?? 0) * DAY_MS);
  return lateMs / windowMs;
}

/** Spread `news` evenly through `reviews` instead of front-loading them.
 *
 *  Slot i takes a new card once fewer than its fair share have been emitted, so
 *  the session warms up on reviews, new words arrive at an even cadence, and it
 *  degrades sanely when either side runs out. With 80 reviews + 15 new a new
 *  card lands roughly every 6th slot. */
export function interleave(reviews: string[], news: string[]): string[] {
  if (reviews.length === 0 || news.length === 0) return [...reviews, ...news];
  const total = reviews.length + news.length;
  const out: string[] = [];
  let ri = 0;
  let ni = 0;
  for (let i = 0; i < total; i++) {
    const fairShare = Math.round(((i + 1) * news.length) / total);
    const takeNew = ni < news.length && (ri >= reviews.length || ni < fairShare);
    out.push(takeNew ? news[ni++] : reviews[ri++]);
  }
  return out;
}

// --- the queue ---------------------------------------------------------------

export async function buildQueue(
  supabase: SupabaseClient,
  userId: string,
  pace: StudyPace,
  now: Date = new Date(),
  opts: { limit?: number; ignoreBudget?: boolean } = {},
): Promise<QueuePlan> {
  const load = await getTodayLoad(supabase, userId, pace, now);
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  // ignoreBudget powers the explicit "study beyond today's plan" escape hatch.
  // A cap with no override turns a keen day into a wall.
  const budget = opts.ignoreBudget
    ? { newCards: pace.newLimit, reviews: pace.reviewLimit }
    : load.remaining;
  const cap = opts.limit ?? Number.POSITIVE_INFINITY;
  const takeReviews = Math.min(budget.reviews, cap);
  const takeNew = Math.min(budget.newCards, Math.max(0, cap - takeReviews));

  const [revRes, newRes] = await Promise.all([
    takeReviews > 0
      ? supabase
          .from("knowledge_items")
          .select("id,srs_due,srs_interval")
          .eq("user_id", userId)
          .gt("srs_reps", 0)
          .eq("srs_suspended", false)
          .or(dueFilter(nowIso))
          .order("srs_due", { ascending: true, nullsFirst: true })
          .order("id", { ascending: true })
          .limit(CANDIDATE_CAP)
      : Promise.resolve({ data: [] as ReviewCandidate[], error: null }),
    takeNew > 0
      ? supabase
          .from("knowledge_items")
          .select("id")
          .eq("user_id", userId)
          .eq("srs_reps", 0)
          .eq("srs_suspended", false)
          // Oldest first, so every word eventually gets looked at once (and can
          // then be parked) instead of being buried forever by newer additions.
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .limit(takeNew)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);
  if (revRes.error) throw revRes.error;
  if (newRes.error) throw newRes.error;

  // PostgREST cannot express the overdueness ratio, so the DB hands us the most
  // absolutely-overdue window and we re-rank inside it. The cap is a deliberate
  // approximation: everything it excludes is LESS absolutely overdue than
  // everything it includes, and short-interval cards (the ones the ratio
  // favours) go overdue soonest and so already cluster at the front of the
  // srs_due sort. If the backlog ever routinely exceeds CANDIDATE_CAP, move this
  // sort into SQL as a stable security-invoker function rather than raising the
  // cap and shipping thousands of rows on every load.
  const reviewIds = [...((revRes.data ?? []) as ReviewCandidate[])]
    .sort((a, b) => {
      const d = overdueRatio(b, nowMs) - overdueRatio(a, nowMs);
      if (d !== 0) return d;
      const da = a.srs_due ? Date.parse(a.srs_due) : 0;
      const db = b.srs_due ? Date.parse(b.srs_due) : 0;
      return da - db || (a.id < b.id ? -1 : 1);
    })
    .slice(0, takeReviews)
    .map((r) => r.id);

  const newIds = ((newRes.data ?? []) as { id: string }[]).map((r) => r.id);

  return {
    ...load,
    ids: interleave(reviewIds, newIds),
    plan: { newCards: newIds.length, reviews: reviewIds.length },
  };
}

/** Fetch rows by id and restore the given order — PostgREST does not preserve
 *  .in() ordering. Chunked so a long id list cannot overflow the URL. */
export async function fetchByIdsInOrder<T extends { id: string }>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  ids: string[],
): Promise<T[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    chunks.push(ids.slice(i, i + IN_CHUNK));
  }
  const results = await Promise.all(
    chunks.map((c) => supabase.from(table).select(select).in("id", c)),
  );
  const found = new Map<string, T>();
  for (const { data, error } of results) {
    if (error) throw error;
    for (const row of (data ?? []) as unknown as T[]) found.set(row.id, row);
  }
  return ids.map((id) => found.get(id)).filter((r): r is T => r !== undefined);
}
