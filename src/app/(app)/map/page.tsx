import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { listUserCollections } from "@/lib/collections";
import { MapClient, type MapItem } from "./map-client";
import type { KnowledgeMap } from "@/lib/types";

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: mapRow }, { count }, items, collections] = await Promise.all([
    supabase
      .from("knowledge_maps")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    // Page past the 1000-row cap so the scope/filter options see every item.
    fetchAllRows<MapItem>((from, to) =>
      supabase
        .from("knowledge_items")
        .select(
          "id,type,term,reading,meaning,example,jlpt_level,source_type,collection_id",
        )
        .eq("user_id", user!.id)
        .order("id")
        .range(from, to),
    ),
    listUserCollections(supabase, user!.id),
  ]);

  const map = mapRow as KnowledgeMap | null;

  return (
    <MapClient
      initialData={map?.data ?? null}
      generatedCount={map?.item_count ?? null}
      generatedAt={map?.created_at ?? null}
      totalItems={count ?? 0}
      items={items}
      collections={collections.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
