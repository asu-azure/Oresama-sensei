import { createClient } from "@/lib/supabase/server";
import { uniqueKanji } from "@/lib/kanji";
import { KanjiBrowser } from "./kanji-browser";

export default async function KanjiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Which kanji the learner has already met (badged in the grid).
  const { data } = await supabase
    .from("knowledge_items")
    .select("term")
    .eq("user_id", user!.id);

  const seen = new Set<string>();
  for (const r of (data ?? []) as { term: string }[]) {
    for (const k of uniqueKanji(r.term)) seen.add(k);
  }

  return <KanjiBrowser seen={Array.from(seen)} />;
}
