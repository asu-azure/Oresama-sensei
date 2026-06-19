import { Fragment, type ReactNode } from "react";
import { furiganaToRuby, stripFurigana } from "@/lib/furigana";

/** Renders a short string inline, turning <ruby> markup and 漢字(かな) notation
 *  into real furigana. Safe — builds React nodes, no dangerouslySetInnerHTML.
 *
 *  Tolerant of trailing okurigana/particles inside the tag
 *  (<ruby>凡庸<rt>ぼんよう</rt>な</ruby>): the base + reading become a real <ruby>,
 *  the trailing text renders inline beside it (no reading). Any stray ruby/rt
 *  tags in the in-between text are stripped so raw markup never leaks. */
export function RubyText({ children }: { children: string }) {
  const text = furiganaToRuby(children ?? "");
  const re = /<ruby>(.*?)<rt>(.*?)<\/rt>([\s\S]*?)<\/ruby>/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  const pushPlain = (s: string) => {
    const clean = stripFurigana(s);
    if (clean) parts.push(<Fragment key={key++}>{clean}</Fragment>);
  };
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) pushPlain(text.slice(last, idx));
    parts.push(
      <ruby key={key++}>
        {m[1]}
        <rt>{m[2]}</rt>
        {m[3] || null}
      </ruby>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) pushPlain(text.slice(last));
  return <>{parts}</>;
}
