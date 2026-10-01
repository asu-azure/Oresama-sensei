// Where a word came from (knowledge_items.source_type), as a short label.
// The v4 app wrote most of these; v5 only adds "manual" (quick-add) and
// "kanji" (mnemonic example words).

const LABELS: Record<string, string> = {
  book: "Book",
  game: "Game",
  series: "Manga / series",
  internet: "Internet",
  real_world: "Real world",
  chat: "Chat",
  kanji: "Kanji mnemonic",
  sns: "SNS helper",
  manual: "Added by hand",
};

export function sourceLabel(t: string | null | undefined): string {
  if (!t) return "Unknown source";
  return LABELS[t] ?? t.replace(/_/g, " ");
}
