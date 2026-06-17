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
  // Spaced-repetition scheduling (FSRS; srs_ease is legacy SM-2, unused)
  srs_due: string | null;
  srs_interval: number;
  srs_ease: number;
  srs_reps: number;
  srs_lapses: number;
  srs_stability: number | null;
  srs_difficulty: number | null;
  srs_state: number | null;
  srs_last_review: string | null;
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
  exercises: Exercise[] | null;
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
  /** Manually-dragged node positions, keyed by node id (item id or
   *  `group-<id>`). Persisted in-place; absent on a freshly generated map. */
  positions?: Record<string, { x: number; y: number }>;
}

/** A cached knowledge map row. */
export interface KnowledgeMap {
  id: string;
  user_id: string;
  data: MapData;
  item_count: number;
  created_at: string;
}

// --- Practice exercises (generated from a lesson or a review test) ---

export type ExerciseType = "mcq" | "arrange" | "cloze";

interface ExerciseBase {
  type: ExerciseType;
  /** Question / instruction. May contain Japanese with <ruby> furigana. */
  prompt: string;
  /** Short why-this-is-right note shown after answering. */
  explanation: string;
  /** When set, links the exercise to a knowledge_items row for SRS grading. */
  item_id?: string | null;
}

export interface McqExercise extends ExerciseBase {
  type: "mcq";
  choices: string[];
  /** Index into `choices` of the correct option. */
  answer: number;
}

export interface ArrangeExercise extends ExerciseBase {
  type: "arrange";
  /** Scrambled tokens shown to the learner. */
  tokens: string[];
  /** Correct ordering of the tokens. */
  answer: string[];
  /** JLPT "★" sentence-ordering mode: when set (0–3), `prompt` contains the
   *  marker `{{BLANKS}}` where four ordered slots render, the slot at this index
   *  carries the ★, and the graded answer is `answer[star_index]`. Absent on
   *  legacy/whole-sentence arrange exercises. */
  star_index?: number | null;
}

export interface ClozeExercise extends ExerciseBase {
  type: "cloze";
  /** The text that belongs in the blank. */
  answer: string;
  /** Optional multiple-choice options for the blank (pick mode). */
  choices?: string[];
}

export type Exercise = McqExercise | ArrangeExercise | ClozeExercise;

export interface ExerciseSet {
  exercises: Exercise[];
}

/** A saved practice test (the "test bank"). `exercises` replays for free. */
export interface ReviewTest {
  id: string;
  title: string;
  scope: string; // 'struggling' | 'new' | 'due' | 'filter'
  meta: { level?: string | null; type?: string | null; item_count?: number } | null;
  exercises: Exercise[];
  created_at: string;
  last_used_at: string | null;
  used_count: number;
}