/** Shared application types. */

export type KnowledgeType = "vocab" | "grammar" | "expression";

export interface Profile {
  id: string;
  display_name: string | null;
  interests: string | null;
  jlpt_target: string;
  native_language: string;
  tone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface KnowledgeItem {
  id: string;
  user_id: string;
  type: KnowledgeType;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  notes: string | null;
  source: string | null;
  times_seen: number;
  last_seen: string;
  created_at: string;
  // Spaced-repetition scheduling
  srs_due: string | null;
  srs_interval: number;
  srs_ease: number;
  srs_reps: number;
  srs_lapses: number;
}

export interface Lesson {
  id: string;
  user_id: string;
  title: string | null;
  image_path: string | null;
  source_text: string | null;
  article_md: string | null;
  tags: string[] | null;
  kind: string; // 'photo' | 'summary'
  created_at: string;
}

/** The structured payload Claude returns when extracting knowledge from
 *  a chat answer or a lesson. Stored into `knowledge_items` with dedupe. */
export interface ExtractedKnowledge {
  type: KnowledgeType;
  term: string;
  reading?: string;
  meaning?: string;
  example?: string;
  jlpt_level?: string;
  notes?: string;
}

/** A knowledge item retrieved by vector search, with similarity score. */
export interface RecalledItem extends KnowledgeItem {
  similarity: number;
}

/** A themed cluster of knowledge items on the Knowledge Map. */
export interface MapGroup {
  id: string;
  label: string;
  theme: string;
  register: string | null;
  note: string | null;
  item_ids: string[];
}

/** A relationship between two items on the map. */
export interface MapEdge {
  source: string;
  target: string;
  relation: string;
}

/** The full generated map structure (item ids reference knowledge_items). */
export interface MapData {
  groups: MapGroup[];
  edges: MapEdge[];
}

/** A cached knowledge map row. */
export interface KnowledgeMap {
  id: string;
  user_id: string;
  data: MapData;
  item_count: number;
  created_at: string;
}
