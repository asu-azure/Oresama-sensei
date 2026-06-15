import { createClient } from "@/lib/supabase/server";
import { ReviewClient, type ReviewCard } from "./review-client";

export default async function ReviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,example,jlpt_level")
    .eq("user_id", user!.id)
    .or(`srs_due.is.null,srs_due.lte.${nowIso}`)
    .order("srs_due", { ascending: true, nullsFirst: true })
    .limit(30);

  return <ReviewClient cards={(data ?? []) as ReviewCard[]} />;
}
