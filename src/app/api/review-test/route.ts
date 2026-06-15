import { createClient } from "@/lib/supabase/server";
import { generateExercises, type ExerciseItemRef } from "@/lib/claude";

type ItemRow = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
};

/** Generate an on-demand practice test from the learner's due (or recent)
 *  saved items. Exercises carry item_ids so answers feed back into SRS. */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const nowIso = new Date().toISOString();
  const cols = "id,type,term,reading,meaning,jlpt_level";

  // Prefer items that are due; fall back to most recently seen.
  const { data: due } = await supabase
    .from("knowledge_items")
    .select(cols)
    .eq("user_id", user.id)
    .or(`srs_due.is.null,srs_due.lte.${nowIso}`)
    .order("srs_due", { ascending: true, nullsFirst: true })
    .limit(16);

  let rows = (due ?? []) as ItemRow[];
  if (rows.length < 5) {
    const { data: recent } = await supabase
      .from("knowledge_items")
      .select(cols)
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
    exercises = await generateExercises({
      content: digest,
      items,
      count: Math.min(8, Math.max(4, items.length)),
    });
  } catch (e) {
    console.error("review test generation failed:", e);
    return new Response("Could not generate a test right now.", {
      status: 503,
    });
  }

  if (exercises.length === 0) {
    return new Response("Could not build a test from your items.", {
      status: 422,
    });
  }
  return Response.json({ exercises });
}