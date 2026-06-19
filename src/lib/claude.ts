import Anthropic from "@anthropic-ai/sdk";
import {
  EXTRACTION_INSTRUCTION,
  KNOWLEDGE_MAP_INSTRUCTION,
  buildExerciseInstruction,
  buildKanjiMnemonicPrompt,
  EXERCISE_REFINE_INSTRUCTION,
  buildDeepDivePrompt,
  buildCoachPrompt,
  buildCollectionSummaryPrompt,
  OCR_PROMPT,
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
import {
  geminiStructured,
  geminiText,
  runGeminiStream,
  generateKanjiMnemonicGemini,
} from "@/lib/gemini";

export const CHAT_MODEL = "claude-sonnet-4-6";
export const LESSON_MODEL = "claude-sonnet-4-6";
export const DEEP_LESSON_MODEL = "claude-opus-4-8";
// The coach note only summarizes an already-digested stats snapshot, so the
// cheapest model is plenty — and it's cached, so it rarely runs.
export const COACH_MODEL = "claude-haiku-4-5";

/** Which provider runs the "secondary" (non-chat, non-lesson) AI calls. Set per
 *  user via profiles.ai_engine; defaults to Gemini for cost. When "gemini",
 *  structured/cheap calls use Flash and conversational ones use Pro; when
 *  "claude", everything falls back to Claude Sonnet. */
export type AiEngine = "gemini" | "claude";

/** Coerce a stored profiles.ai_engine value into an AiEngine (default Gemini —
 *  cheaper; also the fallback when migration 0015 hasn't run yet). */
export function resolveEngine(value: string | null | undefined): AiEngine {
  return value === "claude" ? "claude" : "gemini";
}

let _client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** OCR a page with Claude vision — the fallback/alternative to Gemini. Claude is
 *  pricier and slower for OCR, so this is used when Gemini is overloaded or when
 *  the user explicitly picks it. Reuses the same OCR prompt as Gemini. */
export async function ocrImageWithClaude(
  base64Data: string,
  mimeType: string,
): Promise<string> {
  const media = (
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
      ? mimeType
      : "image/jpeg"
  ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: media, data: base64Data },
          },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  });
  const text = res.content.find((b) => b.type === "text");
  return (text && "text" in text ? text.text : "").trim();
}

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

/** Engine-aware "Ask Sensei" discussion stream. Claude Sonnet, or Gemini Pro
 *  (conversational tier) when engine="gemini". Pushes deltas to onDelta. */
export async function runDiscussStream(opts: {
  system: string;
  messages: ChatTurn[];
  engine?: AiEngine;
  onDelta: (t: string) => void;
}): Promise<string> {
  if ((opts.engine ?? "gemini") === "gemini") {
    return runGeminiStream({
      system: opts.system,
      messages: opts.messages,
      pro: true,
      onDelta: opts.onDelta,
    });
  }
  const stream = streamDiscuss(opts.system, opts.messages);
  stream.on("text", opts.onDelta);
  const final = await stream.finalMessage();
  const t = final.content.find((b) => b.type === "text");
  return t && t.type === "text" ? t.text : "";
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
// Hard ceiling so a many-page upload can't run away (and risk the host's
// per-request time limit). Generous enough for a thorough 6-page lesson.
const LESSON_MAX_TOKENS_CAP = 12000;

/** Which model writes a lesson. "claude" = Sonnet (default quality),
 *  "opus" = Opus (deepest, costliest — only when explicitly chosen),
 *  "gemini"/"gemini-pro" = Gemini Flash/Pro (cheapest). */
export type LessonModelChoice = "claude" | "opus" | "gemini" | "gemini-pro";

/** Build the user message for lesson generation (shared by Claude and Gemini). */
export function lessonUserMessage(
  pageText: string,
  source: "photo" | "text",
): string {
  return source === "text"
    ? `Here is the text I want a lesson on. Create my lesson.\n\n<text>\n${pageText}\n</text>`
    : `Here is the transcribed text from the page I photographed. Create my lesson.\n\n<page_text>\n${pageText}\n</page_text>`;
}

/** Run a Claude lesson stream, pushing text deltas to `onDelta`, and resolve
 *  with the full article. Keeps generating server-side even if the browser
 *  disconnects (the caller just stops enqueuing). `pageCount` scales the budget.
 *  `opus` picks the deeper, costlier model — only when the learner asked for it. */
export async function runClaudeLessonStream(opts: {
  system: string;
  pageText: string;
  source?: "photo" | "text";
  pageCount?: number;
  opus?: boolean;
  onDelta: (t: string) => void;
}): Promise<string> {
  const { system, pageText, source = "photo", pageCount = 1, opus = false, onDelta } = opts;
  const base = opus ? DEEP_LESSON_MAX_TOKENS : LESSON_MAX_TOKENS;
  const maxTokens = Math.min(
    base + Math.max(0, pageCount - 1) * 1800,
    LESSON_MAX_TOKENS_CAP,
  );
  const stream = anthropicClient().messages.stream({
    model: opus ? DEEP_LESSON_MODEL : LESSON_MODEL,
    max_tokens: maxTokens,
    system,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: lessonUserMessage(pageText, source) }],
  });
  stream.on("text", onDelta);
  const final = await stream.finalMessage();
  const t = final.content.find((b) => b.type === "text");
  return t && t.type === "text" ? t.text : "";
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

/** Engine-aware "summary of everything" stream (Claude Sonnet or Gemini Pro). */
export async function runSummaryStream(opts: {
  system: string;
  digest: string;
  engine?: AiEngine;
  onDelta: (t: string) => void;
}): Promise<string> {
  const user = `Here is everything I've saved so far. Write my summary review.\n\n<my_items>\n${opts.digest}\n</my_items>`;
  if ((opts.engine ?? "gemini") === "gemini") {
    return runGeminiStream({ system: opts.system, user, pro: true, onDelta: opts.onDelta });
  }
  const stream = anthropicClient().messages.stream({
    model: LESSON_MODEL,
    max_tokens: LESSON_MAX_TOKENS,
    system: opts.system,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: user }],
  });
  stream.on("text", opts.onDelta);
  const final = await stream.finalMessage();
  const t = final.content.find((b) => b.type === "text");
  return t && t.type === "text" ? t.text : "";
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

const EXTRACTION_JSON_HINT = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"items":[{"type":"vocab|grammar|expression","term":"...","reading":"...","meaning":"...","example":"...","jlpt_level":"...","notes":"..."}]}\nWrite furigana as literal <ruby>漢字<rt>かんじ</rt></ruby> tags (do NOT HTML-escape them).`;

function parseExtraction(raw: string): ExtractedKnowledge[] {
  try {
    const parsed = JSON.parse(raw) as { items?: ExtractedKnowledge[] };
    return (parsed.items ?? []).filter(
      (i) => i.term && KNOWLEDGE_TYPES.includes(i.type),
    );
  } catch {
    return [];
  }
}

/** Extract reusable vocab/grammar/expression items from content. Uses structured
 *  output (Claude json_schema, or Gemini JSON) so the result always parses. */
export async function extractKnowledge(
  content: string,
  engine: AiEngine = "gemini",
): Promise<ExtractedKnowledge[]> {
  const user = `${EXTRACTION_INSTRUCTION}\n\n<content>\n${content}\n</content>`;
  if (engine === "gemini") {
    const raw = await geminiStructured({
      system: "",
      user,
      jsonHint: EXTRACTION_JSON_HINT,
    });
    return parseExtraction(raw);
  }
  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 4000,
    output_config: {
      format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
    },
    messages: [{ role: "user", content: user }],
  });

  const text = res.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return [];
  return parseExtraction(text.text);
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
const MAP_JSON_HINT = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"groups":[{"label":"...","theme":"...","register":"...","note":"...","item_refs":[1,2]}],"edges":[{"source":1,"target":2,"relation":"..."}]}`;

export async function generateKnowledgeMap(
  items: MapInputItem[],
  engine: AiEngine = "gemini",
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

  const user = `${KNOWLEDGE_MAP_INSTRUCTION}\n\n<items>\n${lines.join("\n")}\n</items>`;

  type RawGroup = {
    label: string;
    theme: string;
    register: string;
    note: string;
    item_refs: number[];
  };
  type RawEdge = { source: number; target: number; relation: string };

  let rawJson: string;
  if (engine === "gemini") {
    rawJson = await geminiStructured({ system: "", user, jsonHint: MAP_JSON_HINT });
  } else {
    const res = await anthropicClient().messages.create({
      model: CHAT_MODEL,
      max_tokens: 8000,
      output_config: { format: { type: "json_schema", schema: MAP_SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { groups: [], edges: [] };
    rawJson = text.text;
  }

  let parsed: { groups?: RawGroup[]; edges?: RawEdge[] };
  try {
    parsed = JSON.parse(rawJson);
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
      // Reject ambiguous tiles: a piece must not ALSO appear in the visible
      // sentence (the part outside the {{BLANKS}} slot), or the learner can't
      // tell which copy goes where (the "が tile + sentence-が" problem).
      const visible = prompt.replace("{{BLANKS}}", " ");
      if (answerOrder.some((p) => visible.includes(p))) return null;
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

const EXERCISE_JSON_HINT = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"exercises":[{"type":"mcq|arrange|cloze","prompt":"...","explanation":"...","choices":["..."],"answer_index":0,"tokens":["..."],"answer_order":["..."],"answer_text":"...","star_index":-1,"item_ref":0}]}\nFill EVERY field on every exercise (use "" / [] / -1 where a field doesn't apply). Write furigana as literal <ruby>漢字<rt>かんじ</rt></ruby> tags (do NOT HTML-escape them).`;

/** Generate practice exercises (structured output) from lesson content and/or
 *  saved knowledge items. When items carry refs, each exercise links back to a
 *  knowledge_items row (item_id) for SRS grading. */
export async function generateExercises(
  input: GenerateExercisesInput,
  engine: AiEngine = "gemini",
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

  const user = `${buildExerciseInstruction(types, count)}\n\n<content>\n${input.content.slice(0, 8000)}\n</content>${itemsBlock}`;

  let rawJson: string;
  if (engine === "gemini") {
    rawJson = await geminiStructured({ system: "", user, jsonHint: EXERCISE_JSON_HINT });
  } else {
    const res = await anthropicClient().messages.create({
      model: CHAT_MODEL,
      // ~300 tokens per exercise is plenty; scale with count (cap to stay cheap).
      max_tokens: Math.min(4000, 800 + count * 300),
      output_config: { format: { type: "json_schema", schema: EXERCISE_SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return [];
    rawJson = text.text;
  }

  let parsed: { exercises?: RawExercise[] };
  try {
    parsed = JSON.parse(rawJson);
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

/** Ask Claude to verify and, if needed, fix a single flagged exercise. An
 *  optional `userNote` lets the learner say exactly what's wrong (e.g. "option B
 *  also works", "the が tile duplicates the sentence"). Returns a normalized
 *  Exercise (unchanged if it was already fine), preserving item_id. */
export async function refineExercise(
  ex: Exercise,
  userNote?: string,
  engine: AiEngine = "gemini",
): Promise<Exercise | null> {
  const note = (userNote ?? "").trim();
  const noteBlock = note
    ? `\n\n<learner_note>\n${note}\n</learner_note>`
    : "";
  const user = `${EXERCISE_REFINE_INSTRUCTION}\n\n<exercise>\n${JSON.stringify(exerciseToRaw(ex))}\n</exercise>${noteBlock}`;

  let rawJson: string;
  if (engine === "gemini") {
    rawJson = await geminiStructured({ system: "", user, jsonHint: EXERCISE_JSON_HINT });
  } else {
    const res = await anthropicClient().messages.create({
      model: CHAT_MODEL,
      max_tokens: 1500,
      output_config: { format: { type: "json_schema", schema: EXERCISE_SCHEMA } },
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    rawJson = text.text;
  }

  let parsed: { exercises?: RawExercise[] };
  try {
    parsed = JSON.parse(rawJson);
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

const DEEP_DIVE_JSON_HINT = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"explanation":"...markdown...","examples":[{"ja":"...","en":"..."}]}\nWrite furigana as literal <ruby>漢字<rt>かんじ</rt></ruby> tags (do NOT HTML-escape them).`;

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
  engine?: AiEngine;
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

  const system = buildDeepDivePrompt(input.profile);

  let rawJson: string;
  if ((input.engine ?? "gemini") === "gemini") {
    rawJson = await geminiStructured({ system, user, jsonHint: DEEP_DIVE_JSON_HINT });
  } else {
    const res = await anthropicClient().messages.create({
      model: CHAT_MODEL,
      max_tokens: 1800,
      output_config: { format: { type: "json_schema", schema: DEEP_DIVE_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { explanation: "", examples: [] };
    rawJson = text.text;
  }
  try {
    const parsed = JSON.parse(rawJson) as {
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

export const KANJI_MNEMONIC_SCHEMA = {
  type: "object",
  properties: {
    mnemonic: { type: "string" },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          reading: { type: "string" },
          meaning: { type: "string" },
          example: { type: "string" },
          jlpt_level: { type: "string" },
        },
        required: ["term", "reading", "meaning", "example", "jlpt_level"],
        additionalProperties: false,
      },
    },
  },
  required: ["mnemonic", "examples"],
  additionalProperties: false,
} as const;

export interface KanjiMnemonicResult {
  mnemonic: string;
  examples: ExtractedKnowledge[];
}

/** Strip stray markdown that some models wrap around ruby (`<ruby>…</ruby>` in
 *  backticks / code fences) so furigana renders instead of showing as code. */
function cleanRuby(s: string | undefined): string | undefined {
  if (!s) return s;
  return s.replace(/`+\s*(<ruby>[\s\S]*?<\/ruby>)\s*`+/g, "$1");
}

/** Normalize the structured mnemonic JSON into our shared shape (examples become
 *  ExtractedKnowledge so they can flow straight into storeKnowledge). */
export function parseKanjiMnemonic(raw: string, char: string): KanjiMnemonicResult {
  try {
    const parsed = JSON.parse(raw) as {
      mnemonic?: string;
      examples?: {
        term?: string;
        reading?: string;
        meaning?: string;
        example?: string;
        jlpt_level?: string;
      }[];
    };
    const examples: ExtractedKnowledge[] = (parsed.examples ?? [])
      .filter((e) => e.term && e.term.includes(char))
      .slice(0, 3)
      .map((e) => ({
        type: "vocab" as KnowledgeType,
        term: e.term!.trim(),
        reading: e.reading?.trim() || undefined,
        meaning: e.meaning?.trim() || undefined,
        example: cleanRuby(e.example?.trim()) || undefined,
        jlpt_level: e.jlpt_level?.trim() || undefined,
      }));
    return {
      mnemonic: cleanRuby((parsed.mnemonic ?? "").trim()) ?? "",
      examples,
    };
  } catch {
    return { mnemonic: "", examples: [] };
  }
}

/** Build the user message for kanji-mnemonic generation (shared Claude/Gemini). */
export function kanjiMnemonicUserMessage(input: {
  char: string;
  info: KanjiInfo | null;
  components: KanjiComponent[];
}): string {
  const meaning = input.info?.meanings.join(", ") || "(unknown)";
  const readings = [...(input.info?.kun ?? []), ...(input.info?.on ?? [])].join(
    "、",
  );
  const components =
    input.components.map((c) => c.el).join(" + ") || "(no sub-components)";
  return `Kanji: ${input.char}\nMeaning: ${meaning}\nReadings: ${readings || "(none)"}\nComponents: ${components}`;
}

/** Generate a personalized kanji mnemonic + example words, structured so the
 *  examples can be saved to the learner's library. `model` picks the provider
 *  (Claude Sonnet for richer pedagogy, Gemini Flash for lower cost). */
export async function generateKanjiMnemonic(input: {
  char: string;
  info: KanjiInfo | null;
  components: KanjiComponent[];
  profile: Profile | null;
  model?: "claude" | "gemini";
}): Promise<KanjiMnemonicResult> {
  const userMsg = kanjiMnemonicUserMessage(input);
  const system = buildKanjiMnemonicPrompt(input.profile);

  if (input.model === "gemini") {
    const raw = await generateKanjiMnemonicGemini(system, userMsg);
    return parseKanjiMnemonic(raw, input.char);
  }

  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 1200,
    output_config: {
      format: { type: "json_schema", schema: KANJI_MNEMONIC_SCHEMA },
    },
    system,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content.find((b) => b.type === "text");
  return parseKanjiMnemonic(
    text && text.type === "text" ? text.text : "",
    input.char,
  );
}

/** Generate a brief AI overview of a whole collection (book/game/series) from
 *  its lesson overviews + saved knowledge. Returns Markdown (may contain ruby).
 *  Callers cache it in collections.summary_md. */
export async function generateCollectionSummary(input: {
  title: string;
  kind: string;
  digest: string;
  profile: Profile | null;
  engine?: AiEngine;
}): Promise<string> {
  const system = buildCollectionSummaryPrompt(input.profile);
  const user = `Source: ${input.title} (${input.kind})\n\nWhat the learner has collected from it so far:\n\n${input.digest}`;
  if ((input.engine ?? "gemini") === "gemini") {
    return geminiText({ system, user, pro: true });
  }
  const res = await anthropicClient().messages.create({
    model: CHAT_MODEL,
    max_tokens: 700,
    system,
    messages: [{ role: "user", content: user }],
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

const COACH_JSON_HINT = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"summary_md":"...markdown...","focus_areas":[{"label":"...","why":"...","action":"..."}]}\nWrite furigana as literal <ruby>漢字<rt>かんじ</rt></ruby> tags (do NOT HTML-escape them).`;

/** Turn a deterministic strengths/weaknesses digest into a short coaching note
 *  with named focus areas. Cheap model + structured output; callers cache it. */
export async function generateCoachNote(input: {
  digest: string;
  profile: Profile | null;
  engine?: AiEngine;
}): Promise<CoachNote> {
  const system = buildCoachPrompt(input.profile);
  const user = `Here is the learner's current progress snapshot. Coach me.\n\n<snapshot>\n${input.digest}\n</snapshot>`;

  let rawJson: string;
  if ((input.engine ?? "gemini") === "gemini") {
    rawJson = await geminiStructured({ system, user, jsonHint: COACH_JSON_HINT });
  } else {
    const res = await anthropicClient().messages.create({
      model: COACH_MODEL,
      max_tokens: 1200,
      output_config: { format: { type: "json_schema", schema: COACH_SCHEMA } },
      system,
      messages: [{ role: "user", content: user }],
    });
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return { summary_md: "", focus_areas: [] };
    rawJson = text.text;
  }
  try {
    const parsed = JSON.parse(rawJson) as Partial<CoachNote>;
    return {
      summary_md: (parsed.summary_md ?? "").trim(),
      focus_areas: (parsed.focus_areas ?? []).slice(0, 4),
    };
  } catch {
    return { summary_md: "", focus_areas: [] };
  }
}