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
}

export interface Lesson {
  id: string;
  user_id: string;
  title: string | null;
  image_path: string | null;
  source_text: string | null;
  article_md: string | null;
  tags: string[] | null;
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
