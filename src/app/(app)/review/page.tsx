import { createClient } from "@/lib/supabase/server";
import { ReviewClient, type ReviewCard } from "./review-client";

const COLS = "id,type,term,reading,meaning,example,jlpt_level";

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
    return <ReviewClient cards={data ? ([data] as ReviewCard[]) : []} />;
  }

  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("knowledge_items")
    .select(COLS)
    .eq("user_id", user!.id)
    .or(`srs_due.is.null,srs_due.lte.${nowIso}`)
    .order("srs_due", { ascending: true, nullsFirst: true })
    .limit(30);

  return <ReviewClient cards={(data ?? []) as ReviewCard[]} />;
}