import { createClient } from "@/lib/supabase/server";
import { getInfo, getStrokes } from "@/lib/kanji";
import { KanjiDetail, type ExampleWord } from "./kanji-detail";

export default async function KanjiCharPage({
  params,
}: {
  params: Promise<{ char: string }>;
}) {
  const { char: raw } = await params;
  const char = decodeURIComponent(raw);

  const [info, strokes] = await Promise.all([getInfo(char), getStrokes(char)]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let examples: ExampleWord[] = [];
  let mnemonic: string | null = null;
  let learned = false;
  if (user && char) {
    const [{ data: words }, { data: row }] = await Promise.all([
      supabase
        .from("knowledge_items")
        .select("id,term,reading,meaning")
        .eq("user_id", user.id)
        .ilike("term", `%${char}%`)
        .limit(30),
      // `kanji` table may not exist yet (migration 0007); errors → null row.
      supabase
        .from("kanji")
        .select("mnemonic,learned")
        .eq("user_id", user.id)
        .eq("character", char)
        .maybeSingle(),
    ]);
    examples = (words ?? []) as ExampleWord[];
    mnemonic = row?.mnemonic ?? null;
    learned = row?.learned ?? false;
  }

  return (
    <KanjiDetail
      char={char}
      info={info}
      strokes={strokes}
      examples={examples}
      initialMnemonic={mnemonic}
      initialLearned={learned}
    />
  );
}
