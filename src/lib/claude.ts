import Anthropic from "@anthropic-ai/sdk";
import { EXTRACTION_INSTRUCTION } from "@/lib/prompts";
import type { ExtractedKnowledge, KnowledgeType } from "@/lib/types";

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

/** Stream a generated lesson from transcribed page text. */
export function streamLesson(system: string, pageText: string, deep = false) {
  return anthropicClient().messages.stream({
    model: deep ? DEEP_LESSON_MODEL : LESSON_MODEL,
    max_tokens: 8000,
    system,
    thinking: { type: "adaptive" },
    output_config: { effort: deep ? "high" : "medium" },
    messages: [
      {
        role: "user",
        content: `Here is the transcribed text from the page I photographed. Create my lesson.\n\n<page_text>\n${pageText}\n</page_text>`,
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
