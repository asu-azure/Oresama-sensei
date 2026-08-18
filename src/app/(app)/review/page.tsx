import { createClient } from "@/lib/supabase/server";
import { getStudyPace } from "@/lib/study-pace";
import { buildQueue, fetchByIdsInOrder } from "@/lib/review-queue";
import { ReviewClient, type ReviewCard, type CardMeta } from "./review-client";
import {
  previewIntervals,
  retrievability,
  type IntervalPreview,
  type SrsRow,
} from "@/lib/srs";
import { masteryLevel } from "@/lib/mastery";
import { pageRefLabel } from "@/lib/source";
import { uniqueKanji, levelOf, getInfo } from "@/lib/kanji";

/** Cards hydrated per page render. The DAILY BUDGET is the real bound on a
 *  session; this is only a rendering window, because buildMeta signs image URLs
 *  per card. Grading a batch shrinks the remaining budget, so the next render
 *  naturally yields the next slice — no cursor to track. */
const RENDER_BATCH = 30;

const COLS =
  "id,type,term,reading,meaning,example,jlpt_level,part_of_speech,personal_note,image_path,image_source,srs_stability,srs_difficulty,srs_state,srs_interval,srs_reps,srs_lapses,srs_last_review,last_seen";
// Source/history fields + embedded collection & lesson titles for the details panel.
const SELECT =
  COLS +
  ",times_seen,source_type,collection_id,lesson_id,collections(title),lessons(title,page_start,page_end)";

type Row = ReviewCard &
  SrsRow & {
    times_seen?: number | null;
    source_type?: string | null;
    collection_id?: string | null;
    lesson_id?: string | null;
    image_path?: string | null;
    image_source?: string | null;
    collections?: { title: string } | null;
    lessons?: {
      title: string | null;
      page_start: number | null;
      page_end: number | null;
    } | null;
  };

/** Sign an item's stored image path into {thumb, full} (mirrors signThumbs in
 *  library/actions.ts). Returns null if signing fails. */
async function signItemImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
): Promise<{ thumb: string; full: string } | null> {
  const bucket = supabase.storage.from("lesson-images");
  const [{ data: t }, { data: f }] = await Promise.all([
    bucket.createSignedUrl(path, 3600, {
      transform: { width: 1280, quality: 50, resize: "contain" },
    }),
    bucket.createSignedUrl(path, 3600),
  ]);
  const thumb = t?.signedUrl ?? f?.signedUrl ?? "";
  const full = f?.signedUrl ?? t?.signedUrl ?? "";
  return thumb ? { thumb, full } : null;
}

function buildPreviews(rows: Row[]): Record<string, IntervalPreview> {
  const now = new Date();
  const out: Record<string, IntervalPreview> = {};
  for (const r of rows) out[r.id] = previewIntervals(r, now);
  return out;
}

/** Kanji in a term we have data for, each with its primary English meaning, for
 *  the tappable breakdown on the answer side. Data is bundled offline so this is
 *  cheap; computed on the server so the client never blocks on a lazy import. */
async function kanjiGlosses(term: string): Promise<{ char: string; meaning: string }[]> {
  const chars = uniqueKanji(term).filter((c) => levelOf(c));
  return Promise.all(
    chars.map(async (c) => ({
      char: c,
      meaning: (await getInfo(c))?.meanings?.[0] ?? "",
    })),
  );
}

/** Per-card source/history/strength metadata for the collapsible details panel. */
async function buildMeta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Row[],
): Promise<Record<string, CardMeta>> {
  const now = new Date();
  // Every row in parallel, and the two awaits inside a row in parallel too.
  // Serially this was ~3 round-trips per card (2 signed URLs + the kanji data),
  // i.e. 90 sequential hops for a 30-card batch before the page could render.
  const entries = await Promise.all(
    rows.map(async (r): Promise<[string, CardMeta]> => {
      const [kanji, image] = await Promise.all([
        kanjiGlosses(r.term),
        r.image_path ? signItemImage(supabase, r.image_path) : null,
      ]);
      return [
        r.id,
        {
          sourceType: r.source_type ?? null,
          collectionTitle: r.collections?.title ?? null,
          pageRef:
            pageRefLabel(r.lessons?.page_start, r.lessons?.page_end) || null,
          lessonId: r.lesson_id ?? null,
          lessonTitle: r.lessons?.title ?? null,
          timesSeen: r.times_seen ?? 0,
          reps: r.srs_reps ?? 0,
          retr: retrievability(r, now),
          mastery: masteryLevel(r).level,
          kanji,
          image,
          imageSource: r.image_source ?? null,
        },
      ];
    }),
  );
  return Object.fromEntries(entries);
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string; over?: string }>;
}) {
  const { item, over } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const now = new Date();
  const pace = await getStudyPace(supabase, user!.id);

  // Focused single-item review (from the library "Review" link). RLS scopes it.
  if (item) {
    const { data } = await supabase
      .from("knowledge_items")
      .select(SELECT)
      .eq("id", item)
      .maybeSingle();
    const rows = data ? [data as unknown as Row] : [];
    return (
      <ReviewClient
        cards={rows as ReviewCard[]}
        previews={buildPreviews(rows)}
        meta={await buildMeta(supabase, rows)}
        nowMs={now.getTime()}
        single
      />
    );
  }

  // Today's plan: reviews ordered by relative overdueness, with the day's new
  // words woven in — each capped by its own budget. `?over=1` is the explicit
  // "study beyond today's plan" escape hatch.
  const overBudget = over === "1";
  const plan = await buildQueue(supabase, user!.id, pace, now, {
    limit: RENDER_BATCH,
    ignoreBudget: overBudget,
  });

  const rows = await fetchByIdsInOrder<Row>(
    supabase,
    "knowledge_items",
    SELECT,
    plan.ids,
  );

  // Nothing left ANYWHERE (not merely "budget spent") → offer a "study ahead"
  // batch: the scheduled items closest to their due date are exactly the ones
  // whose recall is about to fade. FSRS handles early reviews correctly.
  const trulyEmpty =
    plan.backlog.reviews === 0 && plan.backlog.newCards === 0;
  let aheadCards: ReviewCard[] = [];
  let aheadPreviews: Record<string, IntervalPreview> = {};
  let aheadRows: Row[] = [];
  if (trulyEmpty) {
    let q = supabase
      .from("knowledge_items")
      .select(SELECT)
      .eq("user_id", user!.id)
      .gt("srs_reps", 0)
      .gt("srs_due", now.toISOString())
      .order("srs_due", { ascending: true })
      .limit(RENDER_BATCH);
    if (!plan.degraded.suspend) q = q.eq("srs_suspended", false);
    const { data: ahead } = await q;
    aheadRows = (ahead ?? []) as unknown as Row[];
    aheadCards = aheadRows as ReviewCard[];
    aheadPreviews = buildPreviews(aheadRows);
  }

  const [dueMeta, aheadMeta] = await Promise.all([
    buildMeta(supabase, rows),
    buildMeta(supabase, aheadRows),
  ]);

  return (
    <ReviewClient
      cards={rows as ReviewCard[]}
      previews={buildPreviews(rows)}
      summary={{
        plannedToday: plan.plannedToday.total,
        newCount: plan.plan.newCards,
        reviewCount: plan.plan.reviews,
        doneToday: plan.doneToday.total,
        backlogReviews: plan.backlog.reviews,
        backlogNew: plan.backlog.newCards,
        daysToClear: plan.daysToClear,
        reviewLimit: pace.reviewLimit,
        newLimit: pace.newLimit,
        nextResetIso: plan.nextResetIso,
        degradedLog: plan.degraded.log,
        overBudget,
      }}
      aheadCards={aheadCards}
      aheadPreviews={aheadPreviews}
      meta={{ ...dueMeta, ...aheadMeta }}
      nowMs={now.getTime()}
      dayKey={plan.dayKey}
      canPark={!plan.degraded.suspend}
    />
  );
}
