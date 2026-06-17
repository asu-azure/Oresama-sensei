import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_INSTRUCTION,
  KNOWLEDGE_MAP_INSTRUCTION,
  buildExerciseInstruction,
  buildKanjiMnemonicPrompt,
  EXERCISE_REFINE_INSTRUCTION,
  buildDeepDivePrompt,
  buildCoachPrompt,
} from "@/lib/prompts";
import type {
  Exercise,
  ExerciseType,
  ExtractedKnowledge,
  KnowledgeType,
  MapData,
  Profile,
} from "@/lib/types";
import type { KanjiInfo, KanjiComponent } from "@/lib/kanji";

export const CHAT_MODEL = "claude-sonnet-4-6";
export const LESSON_MODEL = "claude-sonnet-4-6";
export const DEEP_LESSON_MODEL = "claude-opus-4-8";
// The coach note only summarizes an already-digested stats snapshot, so the
// cheapest model is plenty — and it's cached, so it rarely runs.
export const COACH_MODEL = "claude-haiku-4-5";

let _client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Lightweight streaming call for the in-test discuss endpoint — no thinking,
 *  low max_tokens, fast for back-and-forth Q&A. */
export function streamDiscuss(system: string, messages: ChatTurn[]) {
  return anthropicClient().messages.stream({
    model: CHAT_MODEL,
    max_tokens: 1024,
    system,
    messages,
  });
}

/** Stream a tutor answer. Returns a MessageStream; the caller pipes
 *  `.on("text", ...)` deltas to the browser and awaits `.finalMessage()`. */
export function streamChat(system: string, messages: ChatTurn[]) {
  return anthropicClient().messages.stream({
    model: CHAT_MODEL,
    max_tokens: 4096,
    system,
    thinking: { type: "adaptive" },
    // medium effort balances quality and cost for conversational tutoring
    output_config: { effort: "medium" },
    messages,
  });
}

// Lessons/summaries run inside one Vercel function with a 60s cap (Hobby plan),
// so they must finish fast: thinking off + a tight max_tokens. The prompts also
// ask the model to stay concise so it concludes cleanly instead of being cut off.
const LESSON_MAX_TOKENS = 3800;
const DEEP_LESSON_MAX_TOKENS = 4500;

/** Stream a generated lesson from transcribed page text. */
export function streamLesson(
  system: string,
  pageText: string,
  deep = false,
  source: "photo" | "text" = "photo",
) {
  return anthropicClient().messages.stream({
    model: deep ? DEEP_LESSON_MODEL : LESSON_MODEL,
    max_tokens: deep ? DEEP_LESSON_MAX_TOKENS : LESSON_MAX_TOKENS,
    system,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content:
          source === "text"
            ? `Here is the text I want a lesson on. Create my lesson.\n\n<text>\n${pageText}\n</text>`
            : `Here is the transcribed text from the page I photographed. Create my lesson.\n\n<page_text>\n${pageText}\n</page_text>`,
      },
    ],
  });
}

/** Stream a "summary of everything" review from the learner's saved items. */
export function streamSummary(system: string, digest: string, deep = false) {
  return anthropicClient().messages.stream({
    model: deep ? DEEP_LESSON_MODEL : LESSON_MODEL,
    max_tokens: deep ? DEEP_LESSON_MAX_TOKENS : LESSON_MAX_TOKENS,
    system,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content: `Here is everything I've saved so far. Write my summary review.\n\n<my_items>\n${digest}\n</my_items>`,
      },
    ],
  });
}

const KNOWLEDGE_TYPES: KnowledgeType[] = ["vocab", "grammar", "expression"];

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: KNOWLEDGE_TYPES },
          term: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
          example: { type: "string" },
          jlpt_level: { type: "string" },
          notes: { type: "string" },
        },
        required: [
          "type",
          "term",
          "reading",
          "meaning",
          "example",
          "jlpt_level",
          "notes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

/** Extract reusable vocab/grammar/expression items from content, using
 *  Claude structured outputs so the JSON is guaranteed to parse. */
export async function extractKnowledge(
  content: string,
): Promise<ExtractedKnowledge[]> {
  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 4000,
    output_config: {
      format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `${EXTRACTION_INSTRUCTION}\n\n<content>\n${content}\n</content>`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  try {
    const parsed = JSON.parse(text.text) as { items?: ExtractedKnowledge[] };
    return (parsed.items ?? []).filter(
      (i) => i.term && KNOWLEDGE_TYPES.includes(i.type),
    );
  } catch {
    return [];
  }
}

export type MapInputItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
};

const MAP_SCHEMA = {
  type: "object",
  properties: {
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          theme: { type: "string" },
          register: { type: "string" },
          note: { type: "string" },
          item_refs: { type: "array", items: { type: "integer" } },
        },
        required: ["label", "theme", "register", "note", "item_refs"],
        additionalProperties: false,
      },
    },
    edges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "integer" },
          target: { type: "integer" },
          relation: { type: "string" },
        },
        required: ["source", "target", "relation"],
        additionalProperties: false,
      },
    },
  },
  required: ["groups", "edges"],
  additionalProperties: false,
} as const;

/**
 * Ask Claude to group the learner's knowledge items into themed clusters with
 * relationships. Items are sent with short integer "refs" (not UUIDs) for
 * reliable echoing, then resolved back to real ids here.
 */
export async function generateKnowledgeMap(
  items: MapInputItem[],
): Promise<MapData> {
  if (items.length === 0) return { groups: [], edges: [] };

  const capped = items.slice(0, 200);
  const byRef = new Map<number, MapInputItem>();
  const lines = capped.map((it, i) => {
    const ref = i + 1;
    byRef.set(ref, it);
    const bits = [`${ref}.`, `[${it.type}]`, it.term];
    if (it.reading) bits.push(`(${it.reading})`);
    if (it.meaning) bits.push(`— ${it.meaning}`);
    if (it.jlpt_level) bits.push(`[${it.jlpt_level}]`);
    return bits.join(" ");
  });

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 8000,
    output_config: { format: { type: "json_schema", schema: MAP_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${KNOWLEDGE_MAP_INSTRUCTION}\n\n<items>\n${lines.join("\n")}\n</items>`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return { groups: [], edges: [] };

  type RawGroup = {
    label: string;
    theme: string;
    register: string;
    note: string;
    item_refs: number[];
  };
  type RawEdge = { source: number; target: number; relation: string };

  let parsed: { groups?: RawGroup[]; edges?: RawEdge[] };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    return { groups: [], edges: [] };
  }

  const refId = (ref: number) => byRef.get(ref)?.id;

  const groups = (parsed.groups ?? []).map((g, i) => ({
    id: `g${i + 1}`,
    label: g.label,
    theme: g.theme,
    register: g.register || null,
    note: g.note || null,
    item_ids: (g.item_refs ?? [])
      .map(refId)
      .filter((id): id is string => Boolean(id)),
  }));

  const edges = (parsed.edges ?? [])
    .map((e) => ({
      source: refId(e.source),
      target: refId(e.target),
      relation: e.relation,
    }))
    .filter(
      (e): e is { source: string; target: string; relation: string } =>
        Boolean(e.source) && Boolean(e.target) && e.source !== e.target,
    );

  return { groups, edges };
}

// --- Practice exercise generation (multiple-choice / arrange / cloze) ---

const EXERCISE_SCHEMA = {
  type: "object",
  properties: {
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["mcq", "arrange", "cloze"] },
          prompt: { type: "string" },
          explanation: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          tokens: { type: "array", items: { type: "string" } },
          answer_order: { type: "array", items: { type: "string" } },
          answer_text: { type: "string" },
          star_index: { type: "integer" },
          item_ref: { type: "integer" },
        },
        required: [
          "type",
          "prompt",
          "explanation",
          "choices",
          "answer_index",
          "tokens",
          "answer_order",
          "answer_text",
          "star_index",
          "item_ref",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["exercises"],
  additionalProperties: false,
} as const;

export interface ExerciseItemRef {
  ref: number;
  id: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
}

export interface GenerateExercisesInput {
  content: string;
  items?: ExerciseItemRef[];
  types?: ExerciseType[];
  count?: number;
}

type RawExercise = {
  type: ExerciseType;
  prompt: string;
  explanation: string;
  choices: string[];
  answer_index: number;
  tokens: string[];
  answer_order: string[];
  answer_text: string;
  star_index: number;
  item_ref: number;
};

function normalizeExercise(
  r: RawExercise,
  byRef: Map<number, string>,
): Exercise | null {
  const item_id =
    r.item_ref && byRef.has(r.item_ref) ? byRef.get(r.item_ref)! : null;
  const prompt = (r.prompt ?? "").trim();
  if (!prompt) return null;
  const explanation = (r.explanation ?? "").trim();

  if (r.type === "mcq") {
    const raw = (r.choices ?? []).map((x) => x.trim()).filter((x) => x.length > 0);
    if (raw.length < 2) return null;
    const correct = raw[Math.max(0, Math.min(raw.length - 1, r.answer_index ?? 0))];
    // Drop duplicate options (a common malformation), keeping first occurrence.
    const seen = new Set<string>();
    const choices: string[] = [];
    for (const c of raw) {
      if (!seen.has(c)) {
        seen.add(c);
        choices.push(c);
      }
    }
    if (choices.length < 2) return null;
    const answer = Math.max(0, choices.indexOf(correct));
    return { type: "mcq", prompt, explanation, choices, answer, item_id };
  }
  if (r.type === "arrange") {
    const answerOrder = (r.answer_order ?? []).filter(
      (x) => x.trim().length > 0,
    );
    if (answerOrder.length < 2) return null;
    // JLPT "★" mode needs four answer pieces, a valid star slot, and the
    // {{BLANKS}} marker. In that mode the tiles are ALWAYS exactly the four
    // answer pieces (the player shuffles them) — this ignores any malformed or
    // excess "tokens" the model emitted. Otherwise fall back to whole-sentence.
    const star = r.star_index ?? -1;
    const starMode =
      answerOrder.length === 4 &&
      star >= 0 &&
      star <= 3 &&
      prompt.includes("{{BLANKS}}");
    if (starMode) {
      return {
        type: "arrange",
        prompt,
        explanation,
        tokens: answerOrder,
        answer: answerOrder,
        star_index: star,
        item_id,
      };
    }
    const cleanTokens = (r.tokens ?? []).filter((x) => x.trim().length > 0);
    const tokens = cleanTokens.length >= 2 ? cleanTokens : answerOrder;
    return {
      type: "arrange",
      prompt,
      explanation,
      tokens,
      answer: answerOrder,
      star_index: null,
      item_id,
    };
  }
  if (r.type === "cloze") {
    const answer = (r.answer_text ?? "").trim();
    if (!answer) return null;
    const choices = (r.choices ?? []).filter((x) => x.trim().length > 0);
    return {
      type: "cloze",
      prompt,
      explanation,
      answer,
      choices: choices.length >= 2 ? choices : undefined,
      item_id,
    };
  }
  return null;
}

/** Generate practice exercises (structured output) from lesson content and/or
 *  saved knowledge items. When items carry refs, each exercise links back to a
 *  knowledge_items row (item_id) for SRS grading. */
export async function generateExercises(
  input: GenerateExercisesInput,
): Promise<Exercise[]> {
  const types = input.types ?? ["mcq", "arrange", "cloze"];
  const count = input.count ?? 6;

  const itemLines = (input.items ?? []).map((it) => {
    const bits = [`${it.ref}.`, it.term];
    if (it.reading) bits.push(`(${it.reading})`);
    if (it.meaning) bits.push(`— ${it.meaning}`);
    if (it.jlpt_level) bits.push(`[${it.jlpt_level}]`);
    return bits.join(" ");
  });
  const itemsBlock =
    itemLines.length > 0
      ? `\n\n<items>\nBase each exercise on one of these saved items and set "item_ref" to its number:\n${itemLines.join("\n")}\n</items>`
      : "";

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 6000,
    output_config: { format: { type: "json_schema", schema: EXERCISE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${buildExerciseInstruction(types, count)}\n\n<content>\n${input.content.slice(0, 8000)}\n</content>${itemsBlock}`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  let parsed: { exercises?: RawExercise[] };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    return [];
  }

  const byRef = new Map<number, string>();
  for (const it of input.items ?? []) byRef.set(it.ref, it.id);

  return (parsed.exercises ?? [])
    .map((r) => normalizeExercise(r, byRef))
    .filter((e): e is Exercise => e !== null);
}

/** Serialize a typed Exercise back into the flat schema shape Claude expects. */
function exerciseToRaw(ex: Exercise): RawExercise {
  return {
    type: ex.type,
    prompt: ex.prompt,
    explanation: ex.explanation,
    choices:
      ex.type === "mcq" ? ex.choices : ex.type === "cloze" ? (ex.choices ?? []) : [],
    answer_index: ex.type === "mcq" ? ex.answer : -1,
    tokens: ex.type === "arrange" ? ex.tokens : [],
    answer_order: ex.type === "arrange" ? ex.answer : [],
    answer_text: ex.type === "cloze" ? ex.answer : "",
    star_index: ex.type === "arrange" ? (ex.star_index ?? -1) : -1,
    item_ref: 0,
  };
}

/** Ask Claude to verify and, if needed, fix a single flagged exercise. Returns a
 *  normalized Exercise (unchanged if it was already fine), preserving item_id. */
export async function refineExercise(ex: Exercise): Promise<Exercise | null> {
  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 1500,
    output_config: { format: { type: "json_schema", schema: EXERCISE_SCHEMA } },
    messages: [
      {
        role: "user",
        content: `${EXERCISE_REFINE_INSTRUCTION}\n\n<exercise>\n${JSON.stringify(exerciseToRaw(ex))}\n</exercise>`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  let parsed: { exercises?: RawExercise[] };
  try {
    parsed = JSON.parse(text.text);
  } catch {
    return null;
  }
  const raw = parsed.exercises?.[0];
  if (!raw) return null;
  const refined = normalizeExercise(raw, new Map());
  if (!refined) return null;
  refined.item_id = ex.item_id ?? null; // keep SRS linkage
  return refined;
}

const DEEP_DIVE_SCHEMA = {
  type: "object",
  properties: {
    explanation: { type: "string" },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: { ja: { type: "string" }, en: { type: "string" } },
        required: ["ja", "en"],
        additionalProperties: false,
      },
    },
  },
  required: ["explanation", "examples"],
  additionalProperties: false,
} as const;

export type DeepDiveExample = { ja: string; en: string };

/** Generate a personalized deep-dive (nuance/register/pitfalls + fresh examples)
 *  for one saved item. Structured output so it always parses. */
export async function generateDeepDive(input: {
  item: {
    type: string;
    term: string;
    reading: string | null;
    meaning: string | null;
    example: string | null;
    jlpt_level: string | null;
    notes: string | null;
  };
  profile: Profile | null;
  recalled: { term: string; reading: string | null; meaning: string | null }[];
}): Promise<{ explanation: string; examples: DeepDiveExample[] }> {
  const it = input.item;
  const related =
    input.recalled
      .map(
        (r) =>
          `- ${r.term}${r.reading ? ` (${r.reading})` : ""}: ${r.meaning ?? ""}`,
      )
      .join("\n") || "(none)";
  const user = `Item:
- term: ${it.term}
- reading: ${it.reading || "(none)"}
- meaning: ${it.meaning || "(unknown)"}
- type: ${it.type}
- JLPT: ${it.jlpt_level || "?"}
- saved example: ${it.example || "(none)"}
- notes: ${it.notes || "(none)"}

Related items they've studied (avoid repeating these):
${related}`;

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 1800,
    output_config: { format: { type: "json_schema", schema: DEEP_DIVE_SCHEMA } },
    system: buildDeepDivePrompt(input.profile),
    messages: [{ role: "user", content: user }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return { explanation: "", examples: [] };
  try {
    const parsed = JSON.parse(text.text) as {
      explanation?: string;
      examples?: DeepDiveExample[];
    };
    return {
      explanation: (parsed.explanation ?? "").trim(),
      examples: (parsed.examples ?? []).slice(0, 4),
    };
  } catch {
    return { explanation: "", examples: [] };
  }
}

/** Generate a short, personalized kanji mnemonic from its meaning, readings,
 *  and KanjiVG components. Returns Markdown (may contain <ruby> furigana). */
export async function generateKanjiMnemonic(input: {
  char: string;
  info: KanjiInfo | null;
  components: KanjiComponent[];
  profile: Profile | null;
}): Promise<string> {
  const meaning = input.info?.meanings.join(", ") || "(unknown)";
  const readings = [...(input.info?.kun ?? []), ...(input.info?.on ?? [])].join(
    "、",
  );
  const components =
    input.components.map((c) => c.el).join(" + ") || "(no sub-components)";

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 700,
    system: buildKanjiMnemonicPrompt(input.profile),
    messages: [
      {
        role: "user",
        content: `Kanji: ${input.char}\nMeaning: ${meaning}\nReadings: ${readings || "(none)"}\nComponents: ${components}`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text.trim() : "";
}

// --- Personalized study-coach note (from a deterministic stats digest) ---

const COACH_SCHEMA = {
  type: "object",
  properties: {
    summary_md: { type: "string" },
    focus_areas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          why: { type: "string" },
          action: { type: "string" },
        },
        required: ["label", "why", "action"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary_md", "focus_areas"],
  additionalProperties: false,
} as const;

export type CoachFocus = { label: string; why: string; action: string };
export type CoachNote = { summary_md: string; focus_areas: CoachFocus[] };

/** Turn a deterministic strengths/weaknesses digest into a short coaching note
 *  with named focus areas. Cheap model + structured output; callers cache it. */
export async function generateCoachNote(input: {
  digest: string;
  profile: Profile | null;
}): Promise<CoachNote> {
  const res = await anthropicClient().messages.create({
    model: COACH_MODEL,
    max_tokens: 1200,
    output_config: { format: { type: "json_schema", schema: COACH_SCHEMA } },
    system: buildCoachPrompt(input.profile),
    messages: [
      {
        role: "user",
        content: `Here is the learner's current progress snapshot. Coach me.\n\n<snapshot>\n${input.digest}\n</snapshot>`,
      },
    ],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text")
    return { summary_md: "", focus_areas: [] };
  try {
    const parsed = JSON.parse(text.text) as Partial<CoachNote>;
    return {
      summary_md: (parsed.summary_md ?? "").trim(),
      focus_areas: (parsed.focus_areas ?? []).slice(0, 4),
    };
  } catch {
    return { summary_md: "", focus_areas: [] };
  }
}