import { createClient } from "@/lib/supabase/server";
import { generateCoachNote, resolveEngine } from "@/lib/claude";
import { computeInsights, statsDigest, type InsightItem } from "@/lib/insights";
import type { Profile } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let force = false;
  try {
    const body = (await request.json()) as { force?: boolean };
    force = Boolean(body.force);
  } catch {
    // no body → default (use cache)
  }

  const [{ data: items }, { data: profile }, { data: cached }] =
    await Promise.all([
      supabase
        .from("knowledge_items")
        .select(
          "type,jlpt_level,term,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval,srs_due,created_at",
        )
        .eq("user_id", user.id),
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase
        .from("learner_insights")
        .select("summary_md,focus_areas,stats_signature,generated_at")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

  const insights = computeInsights((items ?? []) as InsightItem[]);

  if (insights.total === 0) {
    return Response.json({
      summary_md: "",
      focus_areas: [],
      empty: true,
    });
  }

  // Cache hit: same weakness picture and still fresh → no LLM call.
  if (
    !force &&
    cached &&
    cached.stats_signature === insights.signature &&
    Date.now() - new Date(cached.generated_at).getTime() < DAY_MS
  ) {
    return Response.json({
      summary_md: cached.summary_md,
      focus_areas: cached.focus_areas ?? [],
      generated_at: cached.generated_at,
      cached: true,
    });
  }

  const note = await generateCoachNote({
    digest: statsDigest(insights),
    profile: profile as Profile | null,
    engine: resolveEngine(
      (profile as { ai_engine?: string } | null)?.ai_engine,
    ),
  });

  if (!note.summary_md) {
    return new Response("Failed to generate coaching", { status: 502 });
  }

  const generated_at = new Date().toISOString();
  await supabase.from("learner_insights").upsert({
    user_id: user.id,
    summary_md: note.summary_md,
    focus_areas: note.focus_areas,
    stats_signature: insights.signature,
    generated_at,
  });

  return Response.json({
    summary_md: note.summary_md,
    focus_areas: note.focus_areas,
    generated_at,
    cached: false,
  });
}
