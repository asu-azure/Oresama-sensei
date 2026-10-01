// Furigana for short strings (terms, examples): turns <ruby>漢字<rt>かな</rt></ruby>
// markup and 漢字(かな) notation into segments the Ruby component renders as
// real <ruby> elements. Builds data, never HTML, so nothing here can inject markup.

import { furiganaToRuby, stripFurigana } from "./furigana";

export type RubySeg = { text: string } | { base: string; rt: string; tail: string };

/** Tolerant of trailing okurigana/particles inside the tag
 *  (<ruby>凡庸<rt>ぼんよう</rt>な</ruby>): base + reading become a <ruby>, the
 *  trailing text renders beside it. Stray ruby/rt tags in between are stripped. */
export function rubySegments(input: string | null | undefined): RubySeg[] {
  const text = furiganaToRuby(input ?? "");
  const re = /<ruby>(.*?)<rt>(.*?)<\/rt>([\s\S]*?)<\/ruby>/g;
  const out: RubySeg[] = [];
  let last = 0;
  const plain = (s: string) => {
    const clean = stripFurigana(s);
    if (clean) out.push({ text: clean });
  };
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) plain(text.slice(last, idx));
    out.push({ base: m[1], rt: m[2], tail: stripFurigana(m[3] ?? "") });
    last = idx + m[0].length;
  }
  if (last < text.length) plain(text.slice(last));
  return out;
}
