// How much of the JLPT kanji set the learner has met and learned.
//   seen    = appears in any saved word
//   learned = in a word that reached "mastered", OR marked learned by hand
// Percentages count only kanji in the bundled dataset.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "./supabase";
import { LEVELS, kanjiList, levelOf, uniqueKanji, type Level } from "./kanji";
import { masteryLevel, type SrsLike } from "./mastery";

export interface LevelCoverage {
  level: Level;
  total: number;
  learned: number;
  /** Everything met, learned included. */
  seen: number;
}

export interface KanjiCoverage {
  seen: Set<string>;
  learned: Set<string>;
  /** Learned because a word containing it is mastered. */
  auto: Set<string>;
  /** Marked by hand in the `kanji` table. */
  marked: Set<string>;
  perLevel: LevelCoverage[];
  overall: { learned: number; seen: number; total: number; pct: number };
}

type Row = { term: string } & SrsLike;

export async function loadKanjiCoverage(db: SupabaseClient, userId: string): Promise<KanjiCoverage> {
  const [rows, markedRes] = await Promise.all([
    fetchAllRows<Row>((from, to) =>
      db
        .from("knowledge_items")
        .select("term,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval")
        .eq("user_id", userId)
        .order("id")
        .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>,
    ),
    db.from("kanji").select("character").eq("user_id", userId).eq("learned", true),
  ]);

  const seen = new Set<string>();
  const auto = new Set<string>();
  for (const r of rows) {
    const mastered = masteryLevel(r).level === "mastered";
    for (const k of uniqueKanji(r.term)) {
      if (!levelOf(k)) continue;
      seen.add(k);
      if (mastered) auto.add(k);
    }
  }
  const marked = new Set(((markedRes.data ?? []) as { character: string }[]).map((r) => r.character));
  return summarize(seen, auto, marked);
}

/** Recount after the learner marks or unmarks kanji by hand. */
export function summarize(seen: Set<string>, auto: Set<string>, marked: Set<string>): KanjiCoverage {
  const learned = new Set([...auto, ...marked].filter((k) => levelOf(k)));
  const perLevel = LEVELS.map((level) => {
    const list = kanjiList(level);
    let l = 0;
    let s = 0;
    for (const ch of list) {
      if (learned.has(ch)) l++;
      else if (seen.has(ch)) s++;
    }
    return { level, total: list.length, learned: l, seen: l + s };
  });
  const total = perLevel.reduce((n, l) => n + l.total, 0);
  const learnedTotal = perLevel.reduce((n, l) => n + l.learned, 0);
  const seenTotal = perLevel.reduce((n, l) => n + l.seen, 0);
  return {
    seen,
    learned,
    auto,
    marked,
    perLevel,
    overall: {
      learned: learnedTotal,
      seen: seenTotal,
      total,
      pct: total ? Math.round((learnedTotal / total) * 100) : 0,
    },
  };
}
