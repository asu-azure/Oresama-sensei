import { createClient } from "@/lib/supabase/server";
import { LibraryClient, type LibraryItem } from "./library-client";
import { LIBRARY_COLS } from "./columns";

const PAGE_SIZE = 150;

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Two cheap queries instead of pulling every full row up front:
  //  1. the most recent PAGE_SIZE items (rest stream in via infinite scroll)
  //  2. just `created_at` for every item, to build the calendar heat-map counts
  const [{ data: recent }, { data: dates }] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(LIBRARY_COLS)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("knowledge_items")
      .select("created_at")
      .eq("user_id", user!.id),
  ]);

  const items = (recent ?? []) as LibraryItem[];
  const allDates = (dates ?? []) as { created_at: string }[];

  // Items added per UTC day -> { "YYYY-MM-DD": count } (matches dashboard bucketing).
  const dayCounts: Record<string, number> = {};
  for (const r of allDates) {
    const key = r.created_at.slice(0, 10);
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
  }

  return (
    <LibraryClient
      initialItems={items}
      dayCounts={dayCounts}
      total={allDates.length}
      pageSize={PAGE_SIZE}
    />
  );
}
