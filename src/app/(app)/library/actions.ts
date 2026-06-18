"use server";

import { createClient } from "@/lib/supabase/server";
import type { LibraryItem } from "./library-client";
import { LIBRARY_COLS } from "./columns";
import { generateDeepDive, type DeepDiveExample } from "@/lib/claude";
import { recallKnowledge } from "@/lib/memory";
import type { Profile } from "@/lib/types";

const DAY_MS = 86_400_000;

/** Cached "deep dive" for a saved item — generates + caches on first request
 *  (or when `force`). Degrades gracefully if migration 0008 isn't run yet. */
export async function getOrGenerateExplanation(
  itemId: string,
  force = false,
): Promise<
  | { explanation_md: string; examples: DeepDiveExample[] }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (!force) {
    const { data: cached } = await supabase
      .from("knowledge_explanations")
      .select("explanation_md,examples")
      .eq("user_id", user.id)
      .eq("knowledge_item_id", itemId)
      .maybeSingle();
    if (cached?.explanation_md) {
      return {
        explanation_md: cached.explanation_md,
        examples: (cached.examples ?? []) as DeepDiveExample[],
      };
    }
  }

  const { data: item } = await supabase
    .from("knowledge_items")
    .select("id,type,term,reading,meaning,example,jlpt_level,notes")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!item) return { error: "Item not found." };

  const [{ data: profile }, recalledRaw] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    recallKnowledge(supabase, `${item.term} ${item.meaning ?? ""}`, 4),
  ]);
  const recalled = recalledRaw
    .filter((r) => r.id !== itemId)
    .slice(0, 3)
    .map((r) => ({ term: r.term, reading: r.reading, meaning: r.meaning }));

  let result: { explanation: string; examples: DeepDiveExample[] };
  try {
    result = await generateDeepDive({
      item,
      profile: profile as Profile | null,
      recalled,
    });
  } catch (e) {
    console.error("deep dive generation failed:", e);
    return { error: "Couldn't generate an explanation right now." };
  }
  if (!result.explanation) {
    return { error: "Couldn't generate an explanation right now." };
  }

  const { error } = await supabase.from("knowledge_explanations").upsert(
    {
      user_id: user.id,
      knowledge_item_id: itemId,
      explanation_md: result.explanation,
      examples: result.examples,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,knowledge_item_id" },
  );
  if (error) console.error("explanation upsert failed:", error.message);

  return { explanation_md: result.explanation, examples: result.examples };
}

/** Next page of items, newest first, for infinite scroll. `hasMore` is true
 *  when a full page came back (so there is likely another page). */
export async function loadMoreItems(
  offset: number,
  limit: number,
): Promise<{ items: LibraryItem[]; hasMore: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { items: [], hasMore: false };

  const { data } = await supabase
    .from("knowledge_items")
    .select(LIBRARY_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const items = (data ?? []) as unknown as LibraryItem[];
  return { items, hasMore: items.length === limit };
}

/** All items added on a single calendar day (UTC), newest first. A day is
 *  small, so no pagination is needed. `dayKey` is "YYYY-MM-DD". */
export async function loadItemsForDay(dayKey: string): Promise<LibraryItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const start = `${dayKey}T00:00:00.000Z`;
  const end = new Date(Date.parse(start) + DAY_MS).toISOString();

  const { data } = await supabase
    .from("knowledge_items")
    .select(LIBRARY_COLS)
    .eq("user_id", user.id)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as LibraryItem[];
}
