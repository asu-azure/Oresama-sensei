"use client";

import Link from "next/link";
import { uniqueKanji, levelOf } from "@/lib/kanji";

/** Render each kanji in a term as a tappable chip that opens its kanji card.
 *  Only links kanji we have data for; renders nothing if the term has none. */
export function KanjiChips({ term }: { term: string }) {
  const chars = uniqueKanji(term).filter((c) => levelOf(c));
  if (chars.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] text-muted">Kanji:</span>
      {chars.map((c) => (
        <Link
          key={c}
          href={`/kanji/${encodeURIComponent(c)}`}
          className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-jp text-sm transition-colors hover:bg-surface"
        >
          {c}
        </Link>
      ))}
    </div>
  );
}
