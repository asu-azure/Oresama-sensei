import { createClient } from "@/lib/supabase/server";
import { schedule, retrievability, type Rating } from "@/lib/srs";

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
    .select(
      "srs_stability,srs_difficulty,srs_state,srs_interval,srs_reps,srs_lapses,srs_last_review,last_seen",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (error || !item) return new Response("Item not found", { status: 404 });

  const now = new Date();
  const next = schedule(item, rating, now);

  const { error: updErr } = await supabase
    .from("knowledge_items")
    .update({ ...next, last_seen: now.toISOString() })
    .eq("id", itemId);
  if (updErr) return new Response("Update failed", { status: 500 });

  // Log this review event so we can draw the item's sawtooth over time. The
  // current state was just overwritten above, so the `item` snapshot holds the
  // "before" values. Best-effort: never let logging (or a missing review_log
  // table) break a review.
  try {
    const prev = item.srs_last_review ?? item.last_seen;
    const elapsedDays = prev
      ? (now.getTime() - new Date(prev).getTime()) / 86_400_000
      : null;
    const retrBefore = retrievability(item, now); // 0–100 or null (first review)
    await supabase.from("review_log").insert({
      user_id: user.id,
      item_id: itemId,
      rating,
      reviewed_at: now.toISOString(),
      elapsed_days: elapsedDays,
      retrievability: retrBefore === null ? null : retrBefore / 100,
      stability_before: item.srs_stability ?? null,
      stability_after: next.srs_stability,
      difficulty_after: next.srs_difficulty,
      state_after: next.srs_state,
      interval_after: next.srs_interval,
    });
  } catch {
    // ignore — logging is non-critical
  }

  return Response.json({ ok: true, due: next.srs_due });
}
