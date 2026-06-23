import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/fetch-all";
import { uniqueKanji } from "@/lib/kanji";
import { masteryLevel, type SrsLike } from "@/lib/mastery";
import { KanjiBrowser } from "./kanji-browser";

type ItemRow = { term: string } & SrsLike;

export default async function KanjiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pull saved words with their SRS state so we can derive both "seen" (badged)
  // and "learned" (a word containing the kanji has reached mastery).
  // Paged past the 1000-row cap so kanji from words past the first 1000 still
  // get badged.
  const data = await fetchAllRows<ItemRow>((from, to) =>
    supabase
      .from("knowledge_items")
      .select(
        "term,srs_reps,srs_lapses,srs_stability,srs_difficulty,srs_interval",
      )
      .eq("user_id", user!.id)
      .order("id")
      .range(from, to),
  );

  const seen = new Set<string>();
  const learned = new Set<string>();
  for (const r of data) {
    const ks = uniqueKanji(r.term);
    const mastered = masteryLevel(r).level === "mastered";
    for (const k of ks) {
      seen.add(k);
      if (mastered) learned.add(k); // any one mastered word → learned
    }
  }

  // Union in kanji the learner explicitly marked learned (table may not exist).
  const { data: marked } = await supabase
    .from("kanji")
    .select("character")
    .eq("user_id", user!.id)
    .eq("learned", true);
  for (const r of (marked ?? []) as { character: string }[]) {
    learned.add(r.character);
  }

  return (
    <KanjiBrowser seen={Array.from(seen)} learned={Array.from(learned)} />
  );
}
