import { createClient } from "@/lib/supabase/server";
import { LibraryClient, type LibraryItem } from "./library-client";

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("knowledge_items")
    .select(
      "id,type,term,reading,meaning,example,jlpt_level,srs_reps,srs_interval,srs_ease,srs_lapses,srs_due,times_seen,last_seen",
    )
    .eq("user_id", user!.id)
    .order("last_seen", { ascending: false })
    .limit(2000);

  const items = (data ?? []) as LibraryItem[];
  return <LibraryClient items={items} />;
}