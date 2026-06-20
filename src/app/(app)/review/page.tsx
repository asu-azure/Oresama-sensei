import { createClient } from "@/lib/supabase/server";
import { ReviewClient, type ReviewCard, type CardMeta } from "./review-client";
import {
  previewIntervals,
  retrievability,
  type IntervalPreview,
  type SrsRow,
} from "@/lib/srs";
import { masteryLevel } from "@/lib/mastery";
import { pageRefLabel } from "@/lib/source";

const COLS =
  "id,type,term,reading,meaning,example,jlpt_level,part_of_speech,personal_note,srs_stability,srs_difficulty,srs_state,srs_interval,srs_reps,srs_lapses,srs_last_review,last_seen";
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
    collections?: { title: string } | null;
    lessons?: {
      title: string | null;
      page_start: number | null;
      page_end: number | null;
    } | null;
  };

function buildPreviews(rows: Row[]): Record<string, IntervalPreview> {
  const now = new Date();
  const out: Record<string, IntervalPreview> = {};
  for (const r of rows) out[r.id] = previewIntervals(r, now);
  return out;
}

/** Per-card source/history/strength metadata for the collapsible details panel. */
function buildMeta(rows: Row[]): Record<string, CardMeta> {
  const now = new Date();
  const out: Record<string, CardMeta> = {};
  for (const r of rows) {
    out[r.id] = {
      sourceType: r.source_type ?? null,
      collectionTitle: r.collections?.title ?? null,
      pageRef: pageRefLabel(r.lessons?.page_start, r.lessons?.page_end) || null,
      lessonId: r.lesson_id ?? null,
      lessonTitle: r.lessons?.title ?? null,
      timesSeen: r.times_seen ?? 0,
      reps: r.srs_reps ?? 0,
      retr: retrievability(r, now),
      mastery: masteryLevel(r).level,
    };
  }
  return out;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ item?: string }>;
}) {
  const { item } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        meta={buildMeta(rows)}
        single
      />
    );
  }

  const nowIso = new Date().toISOString();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(SELECT)
      .eq("user_id", user!.id)
      .or(`srs_due.is.null,srs_due.lte.${nowIso}`)
      .order("srs_due", { ascending: true, nullsFirst: true })
      .limit(30),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id)
      .or(`srs_due.is.null,srs_due.lte.${nowIso}`),
  ]);

  const rows = (data ?? []) as unknown as Row[];

  // Nothing due → offer a "study ahead" batch: the scheduled items closest to
  // their due date are exactly the ones whose recall is about to fade, so they're
  // the most worth reviewing early. FSRS handles early reviews correctly.
  let aheadCards: ReviewCard[] = [];
  let aheadPreviews: Record<string, IntervalPreview> = {};
  let aheadRows: Row[] = [];
  if (rows.length === 0) {
    const { data: ahead } = await supabase
      .from("knowledge_items")
      .select(SELECT)
      .eq("user_id", user!.id)
      .gt("srs_reps", 0)
      .gt("srs_due", nowIso)
      .order("srs_due", { ascending: true })
      .limit(30);
    aheadRows = (ahead ?? []) as unknown as Row[];
    aheadCards = aheadRows as ReviewCard[];
    aheadPreviews = buildPreviews(aheadRows);
  }

  return (
    <ReviewClient
      cards={rows as ReviewCard[]}
      previews={buildPreviews(rows)}
      totalDue={count ?? rows.length}
      aheadCards={aheadCards}
      aheadPreviews={aheadPreviews}
      meta={{ ...buildMeta(rows), ...buildMeta(aheadRows) }}
    />
  );
}
