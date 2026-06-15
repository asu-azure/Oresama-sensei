import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/gemini";
import type { ExtractedKnowledge, RecalledItem } from "@/lib/types";

/** Cosine-similarity above which a new item is treated as a duplicate of an
 *  existing one (so we bump `times_seen` instead of inserting a new row). */
const DEDUPE_THRESHOLD = 0.9;

/** pgvector accepts its text format `[1,2,3]`, which is exactly JSON. */
function toVector(embedding: number[]): string {
  return JSON.stringify(embedding);
}

/** Vector-search the learner's knowledge base for items relevant to a query. */
export async function recallKnowledge(
  supabase: SupabaseClient,
  queryText: string,
  count = 8,
): Promise<RecalledItem[]> {
  try {
    const emb = await embedText(queryText, "RETRIEVAL_QUERY");
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: toVector(emb),
      match_count: count,
      p_type: null,
    });
    if (error) {
      console.error("recallKnowledge rpc error:", error.message);
      return [];
    }
    return (data ?? []) as RecalledItem[];
  } catch (e) {
    console.error("recallKnowledge failed:", e);
    return [];
  }
}

/**
 * Persist extracted knowledge items with embeddings, deduplicating against
 * what's already stored. This is what makes the app "remember" — re-asking
 * about the same word bumps its counter rather than creating a duplicate.
 */
export async function storeKnowledge(
  supabase: SupabaseClient,
  userId: string,
  items: ExtractedKnowledge[],
  source: "chat" | "lesson",
): Promise<void> {
  for (const item of items) {
    try {
      const text = `${item.term} ${item.reading ?? ""} ${item.meaning ?? ""}`.trim();
      const emb = await embedText(text, "RETRIEVAL_DOCUMENT");
      const vec = toVector(emb);

      const { data } = await supabase.rpc("match_knowledge", {
        query_embedding: vec,
        match_count: 1,
        p_type: item.type,
      });
      const top = (data ?? [])[0] as RecalledItem | undefined;

      if (top && (top.similarity >= DEDUPE_THRESHOLD || top.term === item.term)) {
        await supabase
          .from("knowledge_items")
          .update({
            times_seen: top.times_seen + 1,
            last_seen: new Date().toISOString(),
          })
          .eq("id", top.id);
      } else {
        await supabase.from("knowledge_items").insert({
          user_id: userId,
          type: item.type,
          term: item.term,
          reading: item.reading || null,
          meaning: item.meaning || null,
          example: item.example || null,
          jlpt_level: item.jlpt_level || null,
          notes: item.notes || null,
          source,
          embedding: vec,
        });
      }
    } catch (e) {
      console.error(`storeKnowledge failed for "${item.term}":`, e);
    }
  }
}

/** Store a chat message with its embedding (fire-and-forget friendly). */
export async function storeMessage(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
  },
): Promise<void> {
  let vec: string | null = null;
  try {
    vec = toVector(await embedText(params.content, "RETRIEVAL_DOCUMENT"));
  } catch {
    // Embedding is best-effort; still store the message text.
  }
  await supabase.from("messages").insert({
    conversation_id: params.conversationId,
    user_id: params.userId,
    role: params.role,
    content: params.content,
    embedding: vec,
  });
}
