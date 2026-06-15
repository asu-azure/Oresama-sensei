import { createClient } from "@/lib/supabase/server";
import { MapClient, type MapItem } from "./map-client";
import type { KnowledgeMap } from "@/lib/types";

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: mapRow }, { count }, { data: items }] = await Promise.all([
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
    supabase
      .from("knowledge_items")
      .select("id,type,term,reading,meaning,jlpt_level")
      .eq("user_id", user!.id),
  ]);

  const map = mapRow as KnowledgeMap | null;

  return (
    <MapClient
      initialData={map?.data ?? null}
      generatedCount={map?.item_count ?? null}
      generatedAt={map?.created_at ?? null}
      totalItems={count ?? 0}
      items={(items ?? []) as MapItem[]}
    />
  );
}
