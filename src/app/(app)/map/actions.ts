"use server";

import { createClient } from "@/lib/supabase/server";
import type { MapData } from "@/lib/types";

export type LessonHit = {
  id: string;
  title: string | null;
  kind: string;
  created_at: string;
};

/** Persist the user's manually-arranged node positions into the latest cached
 *  knowledge map (in its `data` jsonb). Replaces the whole position set with the
 *  passed snapshot. RLS scopes everything to the current user. */
export async function saveMapPositions(
  positions: Record<string, { x: number; y: number }>,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: row } = await supabase
    .from("knowledge_maps")
    .select("id,data")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return;

  const data = (row.data ?? {}) as MapData;
  await supabase
    .from("knowledge_maps")
    .update({ data: { ...data, positions } })
    .eq("id", row.id);
}

/** Find the user's lessons whose title/source text/article mention a term.
 *  A heuristic (items aren't linked to a specific lesson), but good enough to
 *  jump from a map node to where the word showed up. */
export async function findLessonsForTerm(term: string): Promise<LessonHit[]> {
  // Strip characters that would break the PostgREST `.or()` filter grammar.
  const safe = term.replace(/[%,()*]/g, " ").trim();
  if (!safe) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const pattern = `%${safe}%`;
  const { data } = await supabase
    .from("lessons")
    .select("id,title,kind,created_at")
    .eq("user_id", user.id)
    .or(
      `source_text.ilike.${pattern},article_md.ilike.${pattern},title.ilike.${pattern}`,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as LessonHit[];
}
