import { Fragment, type ReactNode } from "react";
import { furiganaToRuby } from "@/lib/furigana";

/** Renders a short string inline, turning <ruby> markup and 漢字(かな) notation
 *  into real furigana. Safe — builds React nodes, no dangerouslySetInnerHTML. */
export function RubyText({ children }: { children: string }) {
  const text = furiganaToRuby(children ?? "");
  const re = /<ruby>(.*?)<rt>(.*?)<\/rt><\/ruby>/g;
  const parts: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) {
      parts.push(<Fragment key={key++}>{text.slice(last, idx)}</Fragment>);
    }
    parts.push(
      <ruby key={key++}>
        {m[1]}
        <rt>{m[2]}</rt>
      </ruby>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) {
    parts.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  }
  return <>{parts}</>;
}