import { createClient } from "@/lib/supabase/server";
import { ReviewClient, type ReviewCard } from "./review-client";
import { previewIntervals, type IntervalPreview, type SrsRow } from "@/lib/srs";

const COLS =
  "id,type,term,reading,meaning,example,jlpt_level,srs_stability,srs_difficulty,srs_state,srs_interval,srs_reps,srs_lapses,srs_last_review,last_seen";

type Row = ReviewCard & SrsRow;

function buildPreviews(rows: Row[]): Record<string, IntervalPreview> {
  const now = new Date();
  const out: Record<string, IntervalPreview> = {};
  for (const r of rows) out[r.id] = previewIntervals(r, now);
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
      .select(COLS)
      .eq("id", item)
      .maybeSingle();
    const rows = data ? [data as Row] : [];
    return (
      <ReviewClient
        cards={rows as ReviewCard[]}
        previews={buildPreviews(rows)}
      />
    );
  }

  const nowIso = new Date().toISOString();
  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(COLS)
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

  const rows = (data ?? []) as Row[];
  return (
    <ReviewClient
      cards={rows as ReviewCard[]}
      previews={buildPreviews(rows)}
      totalDue={count ?? rows.length}
    />
  );
}
