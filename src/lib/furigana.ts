// Convert inline readings written as 漢字(かな) / 漢字（かな） into proper ruby
// markup so the reading renders *above* the kanji: <ruby>漢字<rt>かな</rt></ruby>.
//
// Matches a word that STARTS with a kanji (and may include trailing kana/okurigana),
// immediately followed by a parenthesised all-kana reading. Half-width and
// full-width parentheses are both supported. Pure-kana text never matches.

const FURIGANA_RE =
  /([一-鿿々〆][一-鿿々〆぀-ゟ゠-ヿ]*)[（(]([぀-ゟ゠-ヿーー]+)[）)]/g;

export function furiganaToRuby(input: string): string {
  if (!input) return input;
  return input.replace(
    FURIGANA_RE,
    (_match, base: string, reading: string) =>
      `<ruby>${base}<rt>${reading}</rt></ruby>`,
  );
}

/** Remove ruby markup, keeping the visible base text. Used to compare a typed
 *  answer (plain) against an answer that may carry furigana. */
export function stripFurigana(input: string): string {
  if (!input) return input;
  return input
    .replace(/<ruby>(.*?)<rt>.*?<\/rt><\/ruby>/g, "$1")
    .replace(/<\/?(?:ruby|rt|rp)>/g, "");
}

/** Pull a kana reading out of ruby markup (the concatenated <rt> contents).
 *  Used to backfill a missing reading when a term arrived with embedded ruby. */
export function readingFromRuby(input: string): string {
  if (!input) return "";
  let out = "";
  for (const m of input.matchAll(/<rt>(.*?)<\/rt>/g)) out += m[1];
  return out;
}

const KANJI_RE = /[一-鿿々〆]/;

/** Whether a separate reading adds information: only when the term contains
 *  kanji and the reading differs from the term (pure-kana terms => hide it). */
export function showReading(
  term: string,
  reading: string | null | undefined,
): reading is string {
  return !!reading && reading !== term && KANJI_RE.test(term);
}