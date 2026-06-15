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
