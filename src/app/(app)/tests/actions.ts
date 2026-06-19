"use server";

import { createClient } from "@/lib/supabase/server";
import { refineExercise as refineWithAi } from "@/lib/claude";
import type { Exercise } from "@/lib/types";

/** Verify/fix a flagged exercise with AI and, when a saved test or lesson +
 *  index is given, persist the corrected exercise back into its `exercises`
 *  jsonb (RLS scopes to the owner). Returns the refined exercise. */
export async function refineExercise(params: {
  exercise: Exercise;
  testId?: string;
  lessonId?: string;
  index?: number;
  /** Optional free-text note from the learner on what's wrong. */
  note?: string;
}): Promise<{ exercise: Exercise } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  let refined: Exercise | null;
  try {
    refined = await refineWithAi(params.exercise, params.note);
  } catch (e) {
    console.error("exercise refine failed:", e);
    return { error: "Couldn't check this question right now." };
  }
  if (!refined) return { error: "Couldn't produce a fix." };

  if (
    typeof params.index === "number" &&
    (params.testId || params.lessonId)
  ) {
    const table = params.testId ? "review_tests" : "lessons";
    const id = (params.testId ?? params.lessonId)!;
    const { data: row } = await supabase
      .from(table)
      .select("exercises")
      .eq("id", id)
      .maybeSingle();
    const list = (row?.exercises ?? []) as Exercise[];
    if (Array.isArray(list) && params.index >= 0 && params.index < list.length) {
      list[params.index] = refined;
      await supabase.from(table).update({ exercises: list }).eq("id", id);
    }
  }

  return { exercise: refined };
}
