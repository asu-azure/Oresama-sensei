"use server";

import { createClient } from "@/lib/supabase/server";
import { toHiragana, isRomaji, isJapanese } from "wanakana";

export type LessonHit = {
  id: string;
  title: string | null;
  kind: string;
  created_at: string;
};

/** Find lessons whose title/source/article mention the query. Tries the raw
 *  query and, when it's rōmaji, its kana form (so "taberu" finds 食べる). */
export async function searchLessons(query: string): Promise<LessonHit[]> {
  const raw = query.trim();
  if (!raw) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // PostgREST .or() grammar is fragile; strip the chars that would break it.
  const sanitize = (s: string) => s.replace(/[%,()*]/g, " ").trim();
  const variants = new Set<string>();
  const a = sanitize(raw);
  if (a) variants.add(a);
  if (isRomaji(raw)) {
    const kana = sanitize(toHiragana(raw));
    if (kana && isJapanese(kana)) variants.add(kana);
  }
  if (variants.size === 0) return [];

  const ors = [...variants]
    .flatMap((v) => [
      `title.ilike.%${v}%`,
      `source_text.ilike.%${v}%`,
      `article_md.ilike.%${v}%`,
    ])
    .join(",");

  const { data } = await supabase
    .from("lessons")
    .select("id,title,kind,created_at")
    .eq("user_id", user.id)
    .or(ors)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []) as LessonHit[];
}
