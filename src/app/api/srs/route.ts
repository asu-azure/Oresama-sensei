import { createClient } from "@/lib/supabase/server";
import { schedule, type Rating } from "@/lib/srs";

const RATINGS: Rating[] = ["again", "hard", "good", "easy"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: { itemId?: string; rating?: Rating };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { itemId, rating } = body;
  if (!itemId || !rating || !RATINGS.includes(rating)) {
    return new Response("Invalid itemId or rating", { status: 400 });
  }

  const { data: item, error } = await supabase
    .from("knowledge_items")
    .select("srs_interval,srs_ease,srs_reps,srs_lapses")
    .eq("id", itemId)
    .maybeSingle();
  if (error || !item) return new Response("Item not found", { status: 404 });

  const next = schedule(item, rating);

  const { error: updErr } = await supabase
    .from("knowledge_items")
    .update({ ...next, last_seen: new Date().toISOString() })
    .eq("id", itemId);
  if (updErr) return new Response("Update failed", { status: 500 });

  return Response.json({ ok: true, due: next.srs_due });
}
