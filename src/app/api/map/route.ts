import { createClient } from "@/lib/supabase/server";
import { generateKnowledgeMap, type MapInputItem } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";
import type { MapScope } from "@/lib/types";

/** Regenerate the knowledge map from a (possibly scoped) subset of items. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    scope?: MapScope;
  } | null;
  const scope: MapScope = body?.scope ?? { type: "all" };

  // Scope the map to one book / JLPT level / source so a focused, readable
  // cluster fits inside the 200-item generation cap.
  let query = supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,jlpt_level")
    .eq("user_id", user.id);
  if (scope.type === "collection" && scope.value) {
    query = query.eq("collection_id", scope.value);
  } else if (scope.type === "source" && scope.value) {
    query = query.eq("source_type", scope.value);
  } else if (scope.type === "level" && scope.value) {
    query = query.ilike("jlpt_level", `%${scope.value}%`);
  }
  const { data: items } = await query
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (items ?? []) as MapInputItem[];
  if (list.length === 0) {
    return Response.json({
      data: { groups: [], edges: [], scope },
      item_count: 0,
      empty: true,
    });
  }

  let data;
  try {
    data = await generateKnowledgeMap(list, await getAiEngine(supabase, user.id));
  } catch (e) {
    console.error("map generation failed:", e);
    return new Response(
      "Couldn't build the map right now. Please try again in a moment.",
      { status: 503 },
    );
  }
  // Remember what this map was generated from (rides inside the jsonb).
  data = { ...data, scope };

  const { error } = await supabase.from("knowledge_maps").insert({
    user_id: user.id,
    data,
    item_count: list.length,
  });
  if (error) console.error("map save failed:", error.message);

  return Response.json({ data, item_count: list.length });
}
