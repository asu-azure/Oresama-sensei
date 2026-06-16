"use server";

import { createClient } from "@/lib/supabase/server";
import type { LibraryItem } from "./library-client";
import { LIBRARY_COLS } from "./columns";

const DAY_MS = 86_400_000;

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

  const items = (data ?? []) as LibraryItem[];
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

  return (data ?? []) as LibraryItem[];
}
