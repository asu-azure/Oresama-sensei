// Gemini over plain REST — no SDK, so each function bundle stays small.
// Models are named here only; change them in one place.

import { GEMINI_API_KEY } from "astro:env/server";

export const FLASH = "gemini-2.5-flash";
export const EMBED_MODEL = "gemini-embedding-001";
/** 768-dim, L2-normalised — must match the pgvector column (see migrations). */
export const EMBED_DIM = 768;

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Gemini (esp. Flash) drifts into Japanese; explanations must stay English. */
export const ENGLISH_DIRECTIVE =
  "\n\nIMPORTANT: Write all explanations in ENGLISH (the learner's study language). Use Japanese ONLY for the target words, grammar patterns, and example sentences.";

export type Turn = { role: "user" | "assistant"; content: string };

function key(): string {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return GEMINI_API_KEY;
}

/** Retry 429 / 5xx with backoff — Gemini is often briefly overloaded. */
async function call(url: string, body: unknown, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    last = res;
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 700 * 2 ** i + Math.random() * 300));
  }
  const detail = last ? `${last.status} ${(await last.text()).slice(0, 300)}` : "no response";
  throw new Error(`Gemini request failed: ${detail}`);
}

const contents = (turns: Turn[]) =>
  turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] }));

type Candidate = { content?: { parts?: { text?: string; thought?: boolean }[] } };
const textOf = (j: { candidates?: Candidate[] }) =>
  (j.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");

/** Gemini's JSON mode HTML-escapes markup inside strings (`&lt;ruby&gt;`). These
 *  are legal raw inside JSON strings, so decode before JSON.parse. Never
 *  `&quot;` — that would break the JSON itself. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** One structured-JSON answer, parsed. `schema` is Gemini's OpenAPI subset. */
export async function structured<T>(opts: {
  system: string;
  user: string;
  schema: unknown;
  temperature?: number;
}): Promise<T> {
  const res = await call(`${BASE}/${FLASH}:generateContent`, {
    systemInstruction: { parts: [{ text: opts.system + ENGLISH_DIRECTIVE }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      temperature: opts.temperature ?? 0.7,
      // Structured lookups don't need deliberation; this is the latency win.
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return JSON.parse(decodeEntities(textOf(await res.json()).trim())) as T;
}

/** Stream a conversation, calling onDelta per text chunk. */
export async function stream(opts: {
  system: string;
  messages: Turn[];
  onDelta: (t: string) => void;
}): Promise<void> {
  const res = await call(`${BASE}/${FLASH}:streamGenerateContent?alt=sse`, {
    systemInstruction: { parts: [{ text: opts.system + ENGLISH_DIRECTIVE }] },
    contents: contents(opts.messages),
    generationConfig: { temperature: 0.8, thinkingConfig: { thinkingBudget: 512 } },
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const t = textOf(JSON.parse(line.slice(5)));
        if (t) opts.onDelta(t);
      } catch {
        // a keep-alive or partial line; skip
      }
    }
  }
}

/** Document embedding, truncated to EMBED_DIM and L2-normalised. */
export async function embed(text: string): Promise<number[]> {
  const res = await call(`${BASE}/${EMBED_MODEL}:embedContent`, {
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] },
    taskType: "RETRIEVAL_DOCUMENT",
    outputDimensionality: EMBED_DIM,
  });
  const values = ((await res.json()) as { embedding?: { values?: number[] } }).embedding?.values;
  if (!values?.length) throw new Error("Gemini returned no embedding");
  const norm = Math.hypot(...values) || 1;
  return values.map((v) => v / norm);
}
