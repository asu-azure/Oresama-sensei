import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_INSTRUCTION, KNOWLEDGE_MAP_INSTRUCTION } from "@/lib/prompts";
import type {
  ExtractedKnowledge,
  KnowledgeType,
  MapData,
} from "@/lib/types";

export const CHAT_MODEL = "claude-sonnet-4-6";
export const LESSON_MODEL = "claude-sonnet-4-6";
export const DEEP_LESSON_MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export type ChatTurn = { role: "user" | "assistant"; content: string };

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
export function streamLesson(system: string, pageText: string, deep = false) {
  return anthropicClient().messages.stream({
    model: deep ? DEEP_LESSON_MODEL : LESSON_MODEL,
    max_tokens: deep ? DEEP_LESSON_MAX_TOKENS : LESSON_MAX_TOKENS,
    system,
    thinking: { type: "disabled" },
    messages: [
      {
        role: "user",
        content: `Here is the transcribed text from the page I photographed. Create my lesson.\n\n<page_text>\n${pageText}\n</page_text>`,
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
