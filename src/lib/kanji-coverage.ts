// Derive how much of the bundled JLPT kanji set the learner has "learned" vs
// merely "seen" (appears in a saved word). Shared by /kanji (full coverage view)
// and /insights (compact card) so the seen/learned logic lives in one place.
//
// - seen   = kanji that appear in any saved word.
// - learned = kanji from a word that reached SRS "mastered", UNION kanji the user
//             explicitly flagged learned in the `kanji` table.
// Percentages count only kanji that exist in the dataset (levelOf != null).

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all";
import { LEVELS, kanjiList, levelOf, uniqueKanji, type Level } from "@/lib/kanji";
import { masteryLevel, type SrsLike } from "@/lib/mastery";

export interface LevelCoverage {
  level: Level;
  total: number;
  learned: number;
  seen: number; // seen-but-not-learned + learned (i.e. all encountered)
}

export interface KanjiCoverage {
  /** All seen kanji (for browser badging). */
  seen: string[];
  /** All learned kanji (for browser badging). */
  learned: string[];
  perLevel: LevelCoverage[];
  overall: { learned: number; seen: number; total: number; pct: number };
}

type ItemRow = { term: string } & SrsLike;

export async function loadKanjiCoverage(
  supabase: SupabaseClient,
  userId: string,
): Promise<KanjiCoverage> {
  const data = await fetchAllRows<ItemRow>((from, to) =>
    supabase
      .from("knowledge_items")
      .select("term,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval")
      .eq("user_id", userId)
      .order("id")
      .range(from, to),
  );

  const seen = new Set<string>();
  const learned = new Set<string>();
  for (const r of data) {
    const mastered = masteryLevel(r).level === "mastered";
    for (const k of uniqueKanji(r.term)) {
      seen.add(k);
      if (mastered) learned.add(k);
    }
  }

  // Union in explicitly-marked learned kanji (table may not exist → ignore error).
  const { data: marked } = await supabase
    .from("kanji")
    .select("character")
    .eq("user_id", userId)
    .eq("learned", true);
  for (const r of (marked ?? []) as { character: string }[]) {
    learned.add(r.character);
  }

  // Per-level coverage, counting only dataset kanji.
  const perLevel: LevelCoverage[] = LEVELS.map((level) => {
    const list = kanjiList(level);
    let learnedCount = 0;
    let seenCount = 0;
    for (const ch of list) {
      if (learned.has(ch)) learnedCount++;
      else if (seen.has(ch)) seenCount++;
    }
    return {
      level,
      total: list.length,
      learned: learnedCount,
      seen: learnedCount + seenCount,
    };
  });

  const total = perLevel.reduce((s, l) => s + l.total, 0);
  const learnedTotal = perLevel.reduce((s, l) => s + l.learned, 0);
  const seenTotal = perLevel.reduce((s, l) => s + l.seen, 0);

  // Keep only dataset kanji in the returned sets (drop stray non-JLPT chars).
  const datasetSeen = [...seen].filter((k) => levelOf(k) != null);
  const datasetLearned = [...learned].filter((k) => levelOf(k) != null);

  return {
    seen: datasetSeen,
    learned: datasetLearned,
    perLevel,
    overall: {
      learned: learnedTotal,
      seen: seenTotal,
      total,
      pct: total ? Math.round((learnedTotal / total) * 100) : 0,
    },
  };
}
