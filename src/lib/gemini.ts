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
  const res = await withRetry(
    () =>
      ai().models.generateContentStream({
        model: modelId,
        config: { systemInstruction: opts.system },
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
  const jsonHint = `\n\nReturn ONLY valid JSON (no markdown fences) matching exactly:\n{"mnemonic": "...", "examples": [{"term": "...", "reading": "...", "meaning": "...", "example": "...", "jlpt_level": "..."}]}`;
  const res = await withRetry(
    () =>
      ai().models.generateContent({
        model: GEMINI_FLASH,
        config: {
          systemInstruction: system + jsonHint,
          responseMimeType: "application/json",
          temperature: 0.9,
        },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
      }),
    "kanjiMnemonicGemini",
  );
  return (res.text ?? "").trim();
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
