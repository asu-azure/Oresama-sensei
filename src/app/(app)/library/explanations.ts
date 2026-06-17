import type { SupabaseClient } from "@supabase/supabase-js";

export type DeepDiveContent = {
  explanation_md: string;
  examples: { ja: string; en: string }[];
};
export type ExplanationMap = Record<string, DeepDiveContent>;

/** Load the user's cached deep-dive explanations. Returns content for the
 *  currently-rendered items (so they show instantly) plus the full set of ids
 *  that have an explanation (for badging, incl. lazy-loaded rows). The table is
 *  small; resolves empty if migration 0008 hasn't been run. */
export async function loadExplanations(
  supabase: SupabaseClient,
  userId: string,
  renderedIds: Set<string>,
): Promise<{ explanations: ExplanationMap; explainedIds: string[] }> {
  const { data } = await supabase
    .from("knowledge_explanations")
    .select("knowledge_item_id,explanation_md,examples")
    .eq("user_id", userId);

  const explanations: ExplanationMap = {};
  const explainedIds: string[] = [];
  for (const r of (data ?? []) as {
    knowledge_item_id: string;
    explanation_md: string;
    examples: unknown;
  }[]) {
    explainedIds.push(r.knowledge_item_id);
    if (renderedIds.has(r.knowledge_item_id)) {
      explanations[r.knowledge_item_id] = {
        explanation_md: r.explanation_md,
        examples: (r.examples ?? []) as { ja: string; en: string }[],
      };
    }
  }
  return { explanations, explainedIds };
}
