import { createClient } from "@/lib/supabase/server";
import { loadKanjiCoverage } from "@/lib/kanji-coverage";
import { KanjiCoverage } from "@/components/kanji/coverage";
import { KanjiBrowser } from "./kanji-browser";

export default async function KanjiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Seen/learned sets + per-level coverage, derived from saved words + the kanji
  // table (paged past the 1000-row cap inside the helper).
  const coverage = await loadKanjiCoverage(supabase, user!.id);

  return (
    <div className="space-y-6 py-4">
      <KanjiCoverage coverage={coverage} />
      <KanjiBrowser seen={coverage.seen} learned={coverage.learned} />
    </div>
  );
}
