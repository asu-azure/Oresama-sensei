import { createClient } from "@/lib/supabase/server";
import { LibraryClient, type LibraryItem } from "./library-client";
import { LIBRARY_COLS } from "./columns";
import { loadExplanations } from "./explanations";
import { masteryLevel, type MasteryLevel } from "@/lib/mastery";

const PAGE_SIZE = 150;

type StatRow = {
  created_at: string;
  source_type: string | null;
  srs_reps: number | null;
  srs_lapses: number | null;
  srs_difficulty: number | null;
  srs_stability: number | null;
  srs_interval: number | null;
};

export default async function LibraryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Two cheap queries instead of pulling every full row up front:
  //  1. the most recent PAGE_SIZE items (rest stream in via infinite scroll)
  //  2. a few small columns for EVERY item, to build the calendar heat-map,
  //     the DB-wide mastery counts, and the full list of source types.
  const [{ data: recent }, { data: stats }] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select(LIBRARY_COLS)
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE),
    supabase
      .from("knowledge_items")
      .select(
        "created_at,source_type,srs_reps,srs_lapses,srs_difficulty,srs_stability,srs_interval",
      )
      .eq("user_id", user!.id),
  ]);

  const items = (recent ?? []) as unknown as LibraryItem[];
  const allStats = (stats ?? []) as StatRow[];

  // Items added per UTC day -> { "YYYY-MM-DD": count } (matches dashboard bucketing).
  const dayCounts: Record<string, number> = {};
  // DB-wide mastery counts so the legend reflects the whole library, not just
  // the loaded page. Source types collected across all items too.
  const totalCounts: Record<MasteryLevel, number> = {
    new: 0,
    struggling: 0,
    learning: 0,
    young: 0,
    mastered: 0,
  };
  const sourceSet = new Set<string>();
  for (const r of allStats) {
    const key = r.created_at.slice(0, 10);
    dayCounts[key] = (dayCounts[key] ?? 0) + 1;
    totalCounts[masteryLevel(r).level] += 1;
    if (r.source_type) sourceSet.add(r.source_type);
  }
  const allSourceTypes = Array.from(sourceSet).sort();

  // Prefetch existing deep-dive explanations so they show instantly (and are
  // badged). The table is small; gracefully empty if migration 0008 isn't run.
  const { explanations, explainedIds } = await loadExplanations(
    supabase,
    user!.id,
    new Set(items.map((i) => i.id)),
  );

  return (
    <LibraryClient
      initialItems={items}
      dayCounts={dayCounts}
      total={allStats.length}
      totalCounts={totalCounts}
      allSourceTypes={allSourceTypes}
      pageSize={PAGE_SIZE}
      explanations={explanations}
      explainedIds={explainedIds}
    />
  );
}
