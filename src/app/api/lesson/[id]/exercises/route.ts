import { createClient } from "@/lib/supabase/server";
import { generateExercises } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";

/** (Re)generate practice exercises for one lesson and cache them on the row. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabase
    .from("lessons")
    .select("id,article_md,source_text")
    .eq("id", id)
    .maybeSingle();
  if (!data) return new Response("Lesson not found", { status: 404 });

  const content = (data.article_md || data.source_text || "").trim();
  if (!content) {
    return new Response("This lesson has no content yet.", { status: 422 });
  }

  let exercises;
  try {
    exercises = await generateExercises(
      { content, count: 6 },
      await getAiEngine(supabase, user.id),
    );
  } catch (e) {
    console.error("exercise generation failed:", e);
    return new Response("Could not generate exercises right now.", {
      status: 503,
    });
  }
  if (exercises.length === 0) {
    return new Response("Could not build exercises from this lesson.", {
      status: 422,
    });
  }

  await supabase.from("lessons").update({ exercises }).eq("id", id);
  return Response.json({ exercises });
}