import { createClient } from "@/lib/supabase/server";
import { generateExercises, type ExerciseItemRef } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";

type ItemRow = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
};

const COLS = "id,type,term,reading,meaning,jlpt_level";

/** List saved tests (no exercises payload — kept light for the index). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("review_tests")
    .select("id,title,scope,meta,created_at,last_used_at,used_count")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return Response.json({ tests: data ?? [] });
}

/** Generate a test for a chosen scope (or explicit item IDs for remix), save it,
 *  and return it to play. The only step that spends tokens. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    scope?: string;
    level?: string;
    type?: string;
    /** Remix mode: explicit knowledge_items IDs to generate from. */
    itemIds?: string[];
  };

  const nowIso = new Date().toISOString();
  const dateLabel = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  let rows: ItemRow[] = [];
  let titleBase = "Practice";
  let scope = body.scope ?? "due";

  if (body.itemIds?.length) {
    // --- Remix mode: fetch specific knowledge items by ID ---
    let q = supabase
      .from("knowledge_items")
      .select(COLS)
      .in("id", body.itemIds.slice(0, 16))
      .eq("user_id", user.id);
    if (body.type) q = q.eq("type", body.type);
    if (body.level) q = q.eq("jlpt_level", body.level);
    const { data } = await q.limit(12);
    rows = (data ?? []) as ItemRow[];
    if (rows.length === 0) {
      return new Response("No matching items found in selected tests.", {
        status: 400,
      });
    }
    scope = "remix";
    titleBase = "Remix";
  } else {
    // --- Scope-based mode ---
    let query = supabase
      .from("knowledge_items")
      .select(COLS)
      .eq("user_id", user.id);

    if (scope === "struggling") {
      query = query
        .or("srs_lapses.gte.2,srs_difficulty.gte.7")
        .order("srs_reps", { ascending: false });
      titleBase = "Struggling";
    } else if (scope === "new") {
      query = query
        .eq("srs_reps", 0)
        .order("created_at", { ascending: false });
      titleBase = "New & unpracticed";
    } else if (scope === "filter") {
      if (body.level) query = query.eq("jlpt_level", body.level);
      if (body.type) query = query.eq("type", body.type);
      query = query.order("last_seen", { ascending: false });
      titleBase =
        [body.level, body.type].filter(Boolean).join(" ") || "Filtered";
    } else {
      query = query
        .or(`srs_due.is.null,srs_due.lte.${nowIso}`)
        .order("srs_due", { ascending: true, nullsFirst: true });
      titleBase = "Due now";
    }

    const { data } = await query.limit(16);
    rows = (data ?? []) as ItemRow[];
    if (rows.length < 4) {
      const { data: recent } = await supabase
        .from("knowledge_items")
        .select(COLS)
        .eq("user_id", user.id)
        .order("last_seen", { ascending: false })
        .limit(16);
      rows = (recent ?? []) as ItemRow[];
    }
    if (rows.length === 0) {
      return new Response(
        "Nothing to test yet — chat or make a lesson first.",
        { status: 422 },
      );
    }
  }

  const items: ExerciseItemRef[] = rows.slice(0, 12).map((it, i) => ({
    ref: i + 1,
    id: it.id,
    term: it.term,
    reading: it.reading,
    meaning: it.meaning,
    jlpt_level: it.jlpt_level,
  }));

  const digest = items
    .map((r) => {
      const bits = [`${r.ref}.`, r.term];
      if (r.reading) bits.push(`(${r.reading})`);
      if (r.meaning) bits.push(`— ${r.meaning}`);
      if (r.jlpt_level) bits.push(`[${r.jlpt_level}]`);
      return bits.join(" ");
    })
    .join("\n");

  let exercises;
  try {
    exercises = await generateExercises(
      {
        content: digest,
        items,
        count: Math.min(8, Math.max(4, items.length)),
      },
      await getAiEngine(supabase, user.id),
    );
  } catch (e) {
    console.error("test generation failed:", e);
    return new Response("Could not generate a test right now.", { status: 503 });
  }
  if (exercises.length === 0) {
    return new Response("Could not build a test from your items.", {
      status: 422,
    });
  }

  const title = `${titleBase} · ${dateLabel}`;
  const meta = {
    level: body.level ?? null,
    type: body.type ?? null,
    item_count: items.length,
  };

  const { data: inserted } = await supabase
    .from("review_tests")
    .insert({ user_id: user.id, title, scope, meta, exercises })
    .select("id")
    .single();

  return Response.json({ id: inserted?.id ?? null, title, scope, meta, exercises });
}
