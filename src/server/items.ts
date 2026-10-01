// Saving a new word: plain-text term, dedupe on the exact term, embed, insert.
// The embedding keeps new rows consistent with the 1,700+ already stored (the
// match_knowledge RPC and Hisho both expect it); a failed embed still saves.

import type { SupabaseClient } from "@supabase/supabase-js";
import { readingFromRuby, stripFurigana } from "../lib/furigana";
import { ITEM_COLS, type DraftItem, type Item } from "../lib/types";
import { embed } from "./gemini";

const TYPES = new Set(["vocab", "grammar", "expression"]);

export type SaveResult = { item: Item; existed: boolean };

export async function saveItem(
  db: SupabaseClient,
  userId: string,
  d: Partial<DraftItem>,
  attribution: { source: string; source_type: string },
): Promise<SaveResult | null> {
  const term = stripFurigana(d.term ?? "").trim();
  if (!term) return null;
  const reading = (d.reading || readingFromRuby(d.term ?? "") || "").trim();
  const type = TYPES.has(d.type ?? "") ? d.type! : "vocab";

  const { data: found } = await db
    .from("knowledge_items")
    .select(ITEM_COLS)
    .eq("user_id", userId)
    .eq("term", term)
    .limit(1);
  if (found?.length) return { item: found[0] as unknown as Item, existed: true };

  let embedding: string | null = null;
  try {
    // pgvector reads its text format `[1,2,3]`, which is exactly JSON.
    embedding = JSON.stringify(await embed(`${term} ${reading} ${d.meaning ?? ""}`.trim()));
  } catch (e) {
    console.error("embed failed (saving without):", e);
  }

  const { data, error } = await db
    .from("knowledge_items")
    .insert({
      user_id: userId,
      type,
      term,
      reading: reading || null,
      meaning: d.meaning?.trim() || null,
      example: d.example?.trim() || null,
      jlpt_level: d.jlpt_level?.trim() || null,
      notes: d.notes?.trim() || null,
      part_of_speech: d.part_of_speech?.trim() || null,
      source: attribution.source,
      source_type: attribution.source_type,
      embedding,
    })
    .select(ITEM_COLS)
    .single();
  if (error) throw error;
  return { item: data as unknown as Item, existed: false };
}
