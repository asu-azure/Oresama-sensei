import type { SrsRow } from "./srs";

export type KnowledgeType = "vocab" | "grammar" | "expression";

/** A knowledge_items row as the app reads it. */
export type Item = SrsRow & {
  id: string;
  type: KnowledgeType;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  part_of_speech: string | null;
  personal_note: string | null;
  image_path: string | null;
  image_source: string | null;
  srs_due?: string | null;
  srs_suspended?: boolean;
  times_seen?: number | null;
  created_at?: string;
  source_type?: string | null;
};

/** Columns for Item. Keep in step with the type above. */
export const ITEM_COLS =
  "id,type,term,reading,meaning,example,jlpt_level,part_of_speech,personal_note,image_path,image_source," +
  "srs_stability,srs_difficulty,srs_state,srs_interval,srs_reps,srs_lapses,srs_last_review,srs_due,srs_suspended," +
  "last_seen,times_seen,created_at,source_type";

/** What Ask Sensei is looking at. */
export type AskContext =
  | {
      kind: "vocab";
      item: Pick<Item, "type" | "term" | "reading" | "meaning" | "example" | "jlpt_level">;
    }
  | { kind: "kanji"; char: string; meanings?: string[]; on?: string[]; kun?: string[] }
  | { kind: "free" };

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** A word as quick-add drafts it (before saving). */
export type DraftItem = {
  type: KnowledgeType;
  term: string;
  reading: string;
  meaning: string;
  example: string;
  jlpt_level: string;
  part_of_speech: string;
  notes: string;
};
