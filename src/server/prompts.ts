// The prompts that survived the lean-down: Ask Sensei, quick-add, and kanji
// mnemonics. Wording is carried over from the Next.js app's lib/prompts.ts —
// it is tuned; change it deliberately.

import type { AskContext } from "../lib/types";

export type Profile = {
  display_name: string | null;
  jlpt_target: string | null;
  native_language: string | null;
  interests: string | null;
  tone: string | null;
};

export const PROFILE_COLS = "display_name,jlpt_target,native_language,interests,tone";

/** The learner's durable background, always injected (additive to the profile). */
const LEARNER_CONTEXT = `\n\n<learner_background>\nThe learner is a Thai manga-style artist, active on X among Japanese illustrators, who also has a background in English-language teaching, is passionate about music, and keeps up with a lot of world news — politics, crime, society, science, technology, food, and current affairs. Draw on this broad range of interests for examples, analogies, and mnemonics.\n</learner_background>`;

function profileBlock(p: Profile | null): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.display_name) parts.push(`Name: ${p.display_name}`);
  if (p.jlpt_target) parts.push(`JLPT target: ${p.jlpt_target}`);
  if (p.native_language) parts.push(`Native language: ${p.native_language}`);
  if (p.interests) parts.push(`Interests / life context: ${p.interests}`);
  if (p.tone) parts.push(`Preferred tone: ${p.tone}`);
  return `\n\n<learner_profile>\n${parts.join("\n")}\n</learner_profile>`;
}

// --- Ask Sensei ----------------------------------------------------------------

export function discussSystemPrompt(context: AskContext): string {
  let intro = "chatting with";
  let block = "";
  if (context.kind === "vocab") {
    const it = context.item;
    intro = "discussing ONE saved word/grammar item with";
    const lines = [
      `Type: ${it.type ?? "vocab"}`,
      `Term: ${it.term}`,
      it.reading ? `Reading: ${it.reading}` : "",
      it.meaning ? `Meaning: ${it.meaning}` : "",
      it.jlpt_level ? `JLPT: ${it.jlpt_level}` : "",
      it.example ? `Saved example: ${it.example}` : "",
    ].filter(Boolean);
    block = `<item>\n${lines.join("\n")}\n</item>`;
  } else if (context.kind === "kanji") {
    intro = "discussing ONE kanji with";
    const lines = [
      `Kanji: ${context.char}`,
      context.meanings?.length ? `Meanings: ${context.meanings.join(", ")}` : "",
      context.on?.length ? `On'yomi: ${context.on.join("、")}` : "",
      context.kun?.length ? `Kun'yomi: ${context.kun.join("、")}` : "",
    ].filter(Boolean);
    block = `<kanji>\n${lines.join("\n")}\n</kanji>`;
  }

  return `You are 先生 (Sensei), a concise, warm Japanese tutor ${intro} an advanced learner (JLPT N2–N1 level).

${block}

Answer their questions directly and helpfully — why an answer is right or wrong, whether something looks incorrect or ambiguous, nuance, usage, near-synonyms, or more examples. If something is genuinely wrong or ambiguous, say so clearly. Write your answer in ENGLISH (the learner's study language); use Japanese only for the words, patterns, and example sentences themselves. For furigana, write the reading in parentheses right after the kanji word, like 漢字（かんじ） — do NOT output <ruby> HTML tags. Keep answers short (2–4 sentences unless they truly need more).`;
}

// --- Quick-add -----------------------------------------------------------------

const POS_RULE = `part_of_speech — the grammatical class, used to build a conjugation table. Use EXACTLY one of these lowercase labels when it applies: "godan verb" (五段/Group 1, e.g. 書く・話す・読む), "ichidan verb" (一段/Group 2, e.g. 食べる・見る), "suru verb" (する verbs, e.g. 勉強する), "kuru verb" (来る), "i-adjective" (e.g. 高い), "na-adjective" (e.g. 静か), "noun", "adverb", "particle", "expression", or "other". For non-vocab items or anything that doesn't conjugate, use "" or "expression"/"other". Be accurate about godan vs ichidan — it determines the conjugation.`;

export function draftSystemPrompt(profile: Profile | null): string {
  return `You are filling in ONE flashcard for an advanced Japanese learner (JLPT N2–N1). The learner typed something they want to study. It may be Japanese (kanji or kana), rōmaji, English, a set phrase, a grammar pattern, or a whole sentence.

Decide the single Japanese item they most likely mean:
- Japanese or rōmaji → that word/pattern (convert rōmaji to its Japanese form).
- English → the most natural, useful Japanese equivalent; mention one close alternative in "notes" if there is a real choice.
- A whole sentence → its most useful word or grammar pattern, and use the sentence itself as the example.

Fields: type (vocab | grammar | expression), term (the word/grammar pattern/expression in Japanese), reading (kana; for grammar, the pattern reading or empty), meaning (concise English), example (one natural Japanese sentence that shows how it is really used), jlpt_level (best guess like N2/N1, or empty), notes (one short nuance note — register, near-synonym, or pitfall; optional), part_of_speech.

${POS_RULE}

IMPORTANT: "term" and "reading" must be PLAIN text — no <ruby>/<rt> tags, no furigana, no parentheses. Use <ruby>漢字<rt>かんじ</rt></ruby> furigana markup ONLY inside "example", on the kanji above roughly N5.${LEARNER_CONTEXT}${profileBlock(profile)}`;
}

export const DRAFT_SCHEMA = {
  type: "OBJECT",
  properties: {
    type: { type: "STRING", enum: ["vocab", "grammar", "expression"] },
    term: { type: "STRING" },
    reading: { type: "STRING" },
    meaning: { type: "STRING" },
    example: { type: "STRING" },
    jlpt_level: { type: "STRING" },
    notes: { type: "STRING" },
    part_of_speech: { type: "STRING" },
  },
  required: ["type", "term", "reading", "meaning", "example", "jlpt_level", "notes", "part_of_speech"],
};

// --- Kanji mnemonics -------------------------------------------------------------

const KANJI_MNEMONIC_INSTRUCTION = `You are helping an advanced Japanese learner remember a kanji. You will be given the kanji, its meaning(s), readings, and the component parts it is built from. Return TWO things.

1) "mnemonic": a SHORT, vivid memory story that fuses the meanings of the component parts into one memorable mini-scene that lands on the kanji's meaning.
- 2–4 sentences, concrete and visual (the learner is a visual artist — paint a picture).
- Build the story explicitly out of the named components so the shape is encoded, not just the meaning.
- Tie it to the learner's interests/world when it makes the image stickier, but keep it tight.
- You may weave in a key reading once if it helps, but do NOT just list readings.
- Write in English. Use <ruby>漢字<rt>かんじ</rt></ruby> markup for any Japanese kanji you mention. No preamble, no headings.

2) "examples": 2–3 genuinely useful real words that CONTAIN this kanji (prefer common JLPT N3–N1 vocabulary the learner can actually use). For each word give:
- "term": the word in Japanese (must contain the given kanji),
- "reading": its kana reading,
- "meaning": concise English gloss,
- "example": one natural Japanese example sentence using the word, with <ruby> furigana on its kanji,
- "jlpt_level": best guess like "N2"/"N1", or "".
Pick words that show different readings/uses of the kanji when possible. Avoid the kanji in isolation.`;

export function mnemonicSystemPrompt(profile: Profile | null): string {
  return KANJI_MNEMONIC_INSTRUCTION + LEARNER_CONTEXT + profileBlock(profile);
}

export const MNEMONIC_SCHEMA = {
  type: "OBJECT",
  properties: {
    mnemonic: { type: "STRING" },
    examples: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          term: { type: "STRING" },
          reading: { type: "STRING" },
          meaning: { type: "STRING" },
          example: { type: "STRING" },
          jlpt_level: { type: "STRING" },
        },
        required: ["term", "reading", "meaning", "example", "jlpt_level"],
      },
    },
  },
  required: ["mnemonic", "examples"],
};
