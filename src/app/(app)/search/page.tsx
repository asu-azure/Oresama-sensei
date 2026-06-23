import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { SearchClient, type SearchItem } from "./search-client";
import { loadExplanations } from "../library/explanations";

export default async function SearchPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Load the user's items once; matching runs live in the browser (free, instant).
  // Paged past the 1000-row cap so every item is searchable, not just a subset.
  const items = await fetchAllRows<SearchItem>((from, to) =>
    supabase
      .from("knowledge_items")
      .select(
        "id,type,term,reading,meaning,example,jlpt_level,lesson_id,image_path",
      )
      .eq("user_id", user!.id)
      .order("last_seen", { ascending: false })
      .order("id")
      .range(from, to),
  );
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
