import { createClient } from "@/lib/supabase/server";
import { TestsClient, type SavedTestRow } from "./tests-client";

export default async function TestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;
  const nowIso = new Date().toISOString();

  // All counts are plain SQL (no API cost) — they drive the scope picker.
  const [strug, neu, due, levelsRes, saved] = await Promise.all([
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .or("srs_lapses.gte.2,srs_difficulty.gte.7"),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("srs_reps", 0),
    supabase
      .from("knowledge_items")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .or(`srs_due.is.null,srs_due.lte.${nowIso}`),
    supabase.from("knowledge_items").select("jlpt_level").eq("user_id", uid),
    supabase
      .from("review_tests")
      .select("id,title,scope,meta,created_at,last_used_at,used_count")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const levels = Array.from(
    new Set(
      ((levelsRes.data ?? []) as { jlpt_level: string | null }[])
        .map((r) => r.jlpt_level)
        .filter((l): l is string => !!l),
    ),
  ).sort();

  return (
    <TestsClient
      counts={{
        struggling: strug.count ?? 0,
        new: neu.count ?? 0,
        due: due.count ?? 0,
      }}
      levels={levels}
      saved={(saved.data ?? []) as SavedTestRow[]}
    />
  );
}
