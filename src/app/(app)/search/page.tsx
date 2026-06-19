import { createClient } from "@/lib/supabase/server";
import { SearchClient, type SearchItem } from "./search-client";
import { loadExplanations } from "../library/explanations";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load the user's items once; matching runs live in the browser (free, instant).
  const { data } = await supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,example,jlpt_level,lesson_id")
    .eq("user_id", user!.id)
    .order("last_seen", { ascending: false })
    .limit(5000);

  const items = (data ?? []) as SearchItem[];
  const { explanations, explainedIds } = await loadExplanations(
    supabase,
    user!.id,
    new Set(items.map((i) => i.id)),
  );

  return (
    <SearchClient
      items={items}
      explanations={explanations}
      explainedIds={explainedIds}
    />
  );
}
