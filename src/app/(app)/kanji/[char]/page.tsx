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

  // The learner's saved words that contain this kanji.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let examples: ExampleWord[] = [];
  if (user && char) {
    const { data } = await supabase
      .from("knowledge_items")
      .select("id,term,reading,meaning")
      .eq("user_id", user.id)
      .ilike("term", `%${char}%`)
      .limit(30);
    examples = (data ?? []) as ExampleWord[];
  }

  return (
    <KanjiDetail
      char={char}
      info={info}
      strokes={strokes}
      examples={examples}
    />
  );
}
