/** Shared vocabulary for "where did this material come from?" — used by the
 *  uploader, lesson cards, the library, and the books browser so labels/icons
 *  stay consistent. Kept framework-agnostic (no JSX) so both server and client
 *  modules can import it. */

/** What the learner uploaded/typed from. Chosen on the upload form. */
export type MaterialType =
  | "textbook"
  | "game"
  | "series"
  | "internet"
  | "real_world"
  | "chat"
  | "text";

/** A collection's kind (the browsable container types). */
export type CollectionKind = "book" | "game" | "series" | "other";

/** Coarser attribution stamped on each knowledge item. */
export type SourceType =
  | "book"
  | "game"
  | "series"
  | "internet"
  | "real_world"
  | "chat";

/** Material types the learner explicitly picks when uploading photos. */
export const UPLOAD_MATERIAL_TYPES: {
  value: MaterialType;
  label: string;
  /** Emoji used as a lightweight icon in badges/pickers. */
  emoji: string;
  /** When true, the material belongs to a browsable collection (book/game/series). */
  collection?: CollectionKind;
}[] = [
  { value: "textbook", label: "Textbook", emoji: "📖", collection: "book" },
  { value: "series", label: "Manga / Series", emoji: "📚", collection: "series" },
  { value: "game", label: "Game", emoji: "🎮", collection: "game" },
  { value: "internet", label: "Internet", emoji: "🌐" },
  { value: "real_world", label: "Real world", emoji: "📷" },
];

/** Map a material type to the coarse source_type stamped on knowledge items. */
export function sourceTypeForMaterial(m: MaterialType): SourceType {
  switch (m) {
    case "textbook":
      return "book";
    case "game":
      return "game";
    case "series":
      return "series";
    case "internet":
    case "text":
      return "internet";
    case "real_world":
      return "real_world";
    case "chat":
      return "chat";
  }
}

/** The collection kind a material type maps to, or null if it isn't a collection. */
export function collectionKindForMaterial(
  m: MaterialType,
): CollectionKind | null {
  return (
    UPLOAD_MATERIAL_TYPES.find((t) => t.value === m)?.collection ?? null
  );
}

const SOURCE_META: Record<SourceType, { label: string; emoji: string }> = {
  book: { label: "Book", emoji: "📖" },
  series: { label: "Series", emoji: "📚" },
  game: { label: "Game", emoji: "🎮" },
  internet: { label: "Internet", emoji: "🌐" },
  real_world: { label: "Real world", emoji: "📷" },
  chat: { label: "Chat", emoji: "💬" },
};

export function sourceMeta(s: SourceType | string | null | undefined): {
  label: string;
  emoji: string;
} {
  if (s && s in SOURCE_META) return SOURCE_META[s as SourceType];
  return { label: "Other", emoji: "•" };
}

const COLLECTION_KIND_EMOJI: Record<CollectionKind, string> = {
  book: "📖",
  series: "📚",
  game: "🎮",
  other: "•",
};

export function collectionEmoji(kind: string | null | undefined): string {
  return COLLECTION_KIND_EMOJI[(kind as CollectionKind) ?? "other"] ?? "•";
}

/** Render a short page reference like "p.12" or "p.12–15" (or "" when absent). */
export function pageRefLabel(
  start: number | null | undefined,
  end: number | null | undefined,
): string {
  if (start == null) return "";
  if (end != null && end !== start) return `p.${start}–${end}`;
  return `p.${start}`;
}
