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
