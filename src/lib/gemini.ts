import { GoogleGenAI } from "@google/genai";
import { l2normalize } from "@/lib/utils";
import { OCR_PROMPT } from "@/lib/prompts";

/** Embedding dimensionality. Kept <= 2000 so pgvector can index it (HNSW),
 *  and L2-normalized because we truncate Gemini's native output (MRL). */
export const EMBED_DIM = 768;

let _ai: GoogleGenAI | null = null;
function ai(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return _ai;
}

/** Retry transient Gemini errors (503 overloaded, 429 rate limit) with backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      const retryable =
        /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand/i.test(
          msg,
        );
      if (!retryable || i === attempts - 1) break;
      const delay = 700 * 2 ** i + Math.random() * 300;
      console.warn(`${label} retry ${i + 1} after ${Math.round(delay)}ms: ${msg}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Embed a single text. Use RETRIEVAL_DOCUMENT when storing, RETRIEVAL_QUERY
 *  when searching, so the vectors live in the same space appropriately. */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  const res = await withRetry(
    () =>
      ai().models.embedContent({
        model: "gemini-embedding-001",
        contents: text.slice(0, 8000),
        config: { outputDimensionality: EMBED_DIM, taskType },
      }),
    "embedText",
  );
  const values = res.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("Gemini returned no embedding");
  }
  return l2normalize(values);
}

export const GEMINI_FLASH = "gemini-2.5-flash";
export const GEMINI_PRO = "gemini-2.5-pro";

/** Gemini (esp. Flash) tends to answer in Japanese. Reinforce English for every
 *  secondary generation so explanations match the learner's study language —
 *  Japanese stays only where it's the subject (target words + example sentences). */
export const ENGLISH_DIRECTIVE =
  "\n\nIMPORTANT: Write all explanations in ENGLISH (the learner's study language). Use Japanese ONLY for the target words, grammar patterns, and example sentences — every explanation, nuance note, and instruction must be in English.";

/** Gemini's JSON mode HTML-escapes embedded markup, so `<ruby>漢字<rt>…` comes
 *  back as `&lt;ruby&gt;漢字&lt;rt&gt;…` and renders as literal brackets. These
 *  characters are all legal *raw* in JSON string values, so decoding them on the
 *  raw JSON text (before JSON.parse) is safe. We deliberately DON'T decode
 *  `&quot;` — that would inject a `"` and corrupt the JSON structure. */
export function decodeRubyEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

type GeminiTurn = { role: "user" | "assistant"; content: string };

/** Run a Gemini structured-JSON request and return the cleaned raw JSON string
 *  (caller does the JSON.parse with its own schema/normalizer). Flash by default,
 *  Pro when `pro` is set. `jsonHint` describes the exact JSON shape to emit. */
export async function geminiStructured(opts: {
  system: string;
  user: string;
  jsonHint: string;
  pro?: boolean;
}): Promise<string> {
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: opts.pro ? GEMINI_PRO : GEMINI_FLASH,
        config: {
          systemInstruction: opts.system + ENGLISH_DIRECTIVE + opts.jsonHint,
          responseMimeType: "application/json",
          temperature: 0.7,
        },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
      }),
    "geminiStructured",
  );
  return decodeRubyEntities((res.text ?? "").trim());
}

/** Run a Gemini plain-text request (Markdown out). For non-JSON generators like
 *  the collection summary. */
export async function geminiText(opts: {
  system: string;
  user: string;
  pro?: boolean;
}): Promise<string> {
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: opts.pro ? GEMINI_PRO : GEMINI_FLASH,
        config: {
          systemInstruction: opts.system + ENGLISH_DIRECTIVE,
          temperature: 0.8,
        },
        contents: [{ role: "user", parts: [{ text: opts.user }] }],
      }),
    "geminiText",
  );
  return (res.text ?? "").trim();
}

/** Stream a Gemini response, pushing deltas to `onDelta`, resolving with the full
 *  text. Accepts a single user string OR a conversation (assistant→model). Used
 *  for the discuss/summary endpoints. Pro by default for conversational quality. */
export async function runGeminiStream(opts: {
  system: string;
  user?: string;
  messages?: GeminiTurn[];
  pro?: boolean;
  onDelta: (t: string) => void;
}): Promise<string> {
  const contents = opts.messages
    ? opts.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }))
    : [{ role: "user", parts: [{ text: opts.user ?? "" }] }];
  const res = await withRetry(
    () =>
      ai().models.generateContentStream({
        model: opts.pro ? GEMINI_PRO : GEMINI_FLASH,
        config: { systemInstruction: opts.system + ENGLISH_DIRECTIVE },
        contents,
      }),
    "geminiStream",
  );
  let full = "";
  for await (const chunk of res) {
    const t = chunk.text ?? "";
    if (t) {
      full += t;
      opts.onDelta(t);
    }
  }
  return full;
}

/** Stream a generated lesson with Gemini (the cheap alternative to Claude),
 *  pushing text deltas to `onDelta` and resolving with the full article.
 *  `model` selects Flash (cheapest) or Pro (stronger). */
export async function runGeminiLessonStream(opts: {
  system: string;
  userMessage: string;
  model: "gemini" | "gemini-pro";
  onDelta: (t: string) => void;
}): Promise<string> {
  const modelId = opts.model === "gemini-pro" ? GEMINI_PRO : GEMINI_FLASH;
  // Gemini Flash in particular tends to answer in Japanese; reinforce English.
  const englishDirective =
    "\n\nIMPORTANT: Write the lesson body in ENGLISH. Keep the Japanese section headings as given, and use Japanese only for target words, grammar patterns, and example sentences — all explanations must be in English.";
  const res = await withRetry(
    () =>
      ai().models.generateContentStream({
        model: modelId,
        config: { systemInstruction: opts.system + englishDirective },
        contents: [{ role: "user", parts: [{ text: opts.userMessage }] }],
      }),
    "lessonGemini",
  );
  let full = "";
  for await (const chunk of res) {
    const t = chunk.text ?? "";
    if (t) {
      full += t;
      opts.onDelta(t);
    }
  }
  return full;
}

/** Generate a kanji mnemonic + example words with Gemini (cheap path). Returns
 *  the raw JSON string for parseKanjiMnemonic to normalize. */
export async function generateKanjiMnemonicGemini(
  system: string,
  userMessage: string,
): Promise<string> {
  const jsonHint = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"mnemonic": "...", "examples": [{"term": "...", "reading": "...", "meaning": "...", "example": "...", "jlpt_level": "..."}]}\nWrite any furigana as literal <ruby>漢字<rt>かんじ</rt></ruby> tags — do NOT HTML-escape the angle brackets.`;
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: GEMINI_FLASH,
        config: {
          systemInstruction: system + ENGLISH_DIRECTIVE + jsonHint,
          responseMimeType: "application/json",
          temperature: 0.9,
        },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
      }),
    "kanjiMnemonicGemini",
  );
  return decodeRubyEntities((res.text ?? "").trim());
}

/** Read Japanese text from a photographed page using Gemini vision. */
export async function ocrImage(
  base64Data: string,
  mimeType: string,
): Promise<string> {
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: base64Data } },
              { text: OCR_PROMPT },
            ],
          },
        ],
      }),
    "ocrImage",
  );
  return (res.text ?? "").trim();
}
