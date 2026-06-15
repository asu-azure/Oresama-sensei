import { createClient } from "@/lib/supabase/server";
import { generateKnowledgeMap, type MapInputItem } from "@/lib/claude";

/** Regenerate the knowledge map from the user's current knowledge_items. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: items } = await supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,jlpt_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (items ?? []) as MapInputItem[];
  if (list.length === 0) {
    return Response.json({
      data: { groups: [], edges: [] },
      item_count: 0,
      empty: true,
    });
  }

  let data;
  try {
    data = await generateKnowledgeMap(list);
  } catch (e) {
    console.error("map generation failed:", e);
    return new Response(
      "Couldn't build the map right now. Please try again in a moment.",
      { status: 503 },
    );
  }

  const { error } = await supabase.from("knowledge_maps").insert({
    user_id: user.id,
    data,
    item_count: list.length,
  });
  if (error) console.error("map save failed:", error.message);

  return Response.json({ data, item_count: list.length });
}
