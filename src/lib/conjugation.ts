/**
 * Offline Japanese conjugation — pure & client-safe (no data files, no AI).
 *
 * Given a dictionary-form word, its kana reading, and a coarse part-of-speech
 * label (set during extraction, see EXTRACTION_INSTRUCTION), produce the common
 * conjugated forms shown on a flashcard. Operates on the WRITTEN form when its
 * okurigana ending is valid for the class (the kanji stem is constant across
 * conjugation), and falls back to the kana reading otherwise. Returns null when
 * the word doesn't conjugate (nouns, particles, expressions) or the class is
 * unknown — the UI then renders nothing.
 */

export type ConjugationForm = { label: string; form: string };

type VerbClass =
  | "godan"
  | "ichidan"
  | "suru"
  | "kuru"
  | "i-adj"
  | "na-adj";

/** Map a free-form part_of_speech label onto a conjugation class, or null. */
function classify(pos: string | null | undefined): VerbClass | null {
  const p = (pos ?? "").toLowerCase();
  if (!p) return null;
  if (p.includes("godan") || p.includes("五段") || /\bv5\b/.test(p)) return "godan";
  if (p.includes("ichidan") || p.includes("一段") || /\bv1\b/.test(p)) return "ichidan";
  if (p.includes("kuru") || p.includes("来る") || p.includes("くる")) return "kuru";
  if (p.includes("suru") || p.includes("する")) return "suru";
  if (p.includes("na-adj") || p.includes("な-adj") || p.includes("na adj") || p.includes("形容動詞"))
    return "na-adj";
  if (p.includes("i-adj") || p.includes("い-adj") || p.includes("i adj") || p.includes("形容詞"))
    return "i-adj";
  return null;
}

// Final-kana → row shifts + euphonic て/た endings for godan verbs.
const GODAN: Record<string, { a: string; i: string; e: string; o: string; te: string; ta: string }> = {
  う: { a: "わ", i: "い", e: "え", o: "お", te: "って", ta: "った" },
  く: { a: "か", i: "き", e: "け", o: "こ", te: "いて", ta: "いた" },
  ぐ: { a: "が", i: "ぎ", e: "げ", o: "ご", te: "いで", ta: "いだ" },
  す: { a: "さ", i: "し", e: "せ", o: "そ", te: "して", ta: "した" },
  つ: { a: "た", i: "ち", e: "て", o: "と", te: "って", ta: "った" },
  ぬ: { a: "な", i: "に", e: "ね", o: "の", te: "んで", ta: "んだ" },
  ぶ: { a: "ば", i: "び", e: "べ", o: "ぼ", te: "んで", ta: "んだ" },
  む: { a: "ま", i: "み", e: "め", o: "も", te: "んで", ta: "んだ" },
  る: { a: "ら", i: "り", e: "れ", o: "ろ", te: "って", ta: "った" },
};

function godanForms(base: string): ConjugationForm[] | null {
  const last = base.slice(-1);
  const m = GODAN[last];
  if (!m) return null;
  const stem = base.slice(0, -1);
  // 行く is the classic euphonic exception (行って / 行った, not 行いて).
  const ikuExc = base.endsWith("行く") || base === "いく";
  const te = ikuExc ? "って" : m.te;
  const ta = ikuExc ? "った" : m.ta;
  return [
    { label: "Dictionary", form: base },
    { label: "Polite (ます)", form: stem + m.i + "ます" },
    { label: "Negative (ない)", form: stem + m.a + "ない" },
    { label: "Past (た)", form: stem + ta },
    { label: "Te-form (て)", form: stem + te },
    { label: "Potential", form: stem + m.e + "る" },
    { label: "Passive", form: stem + m.a + "れる" },
    { label: "Causative", form: stem + m.a + "せる" },
    { label: "Volitional", form: stem + m.o + "う" },
  ];
}

function ichidanForms(base: string): ConjugationForm[] | null {
  if (!base.endsWith("る")) return null;
  const stem = base.slice(0, -1);
  return [
    { label: "Dictionary", form: base },
    { label: "Polite (ます)", form: stem + "ます" },
    { label: "Negative (ない)", form: stem + "ない" },
    { label: "Past (た)", form: stem + "た" },
    { label: "Te-form (て)", form: stem + "て" },
    { label: "Potential", form: stem + "られる" },
    { label: "Passive", form: stem + "られる" },
    { label: "Causative", form: stem + "させる" },
    { label: "Volitional", form: stem + "よう" },
  ];
}

function suruForms(base: string): ConjugationForm[] {
  // 勉強する → prefix "勉強"; plain する → prefix "".
  const prefix = base.endsWith("する") ? base.slice(0, -2) : base === "する" ? "" : base;
  return [
    { label: "Dictionary", form: prefix + "する" },
    { label: "Polite (ます)", form: prefix + "します" },
    { label: "Negative (ない)", form: prefix + "しない" },
    { label: "Past (た)", form: prefix + "した" },
    { label: "Te-form (て)", form: prefix + "して" },
    { label: "Potential", form: prefix + "できる" },
    { label: "Passive", form: prefix + "される" },
    { label: "Causative", form: prefix + "させる" },
    { label: "Volitional", form: prefix + "しよう" },
  ];
}

function kuruForms(base: string): ConjugationForm[] {
  // Written form keeps 来 constant; kana form changes the reading row.
  const kanji = base.includes("来");
  if (kanji) {
    const s = base.slice(0, -1); // drop る → "来"
    return [
      { label: "Dictionary", form: s + "る" },
      { label: "Polite (ます)", form: s + "ます" },
      { label: "Negative (ない)", form: s + "ない" },
      { label: "Past (た)", form: s + "た" },
      { label: "Te-form (て)", form: s + "て" },
      { label: "Potential", form: s + "られる" },
      { label: "Passive", form: s + "られる" },
      { label: "Causative", form: s + "させる" },
      { label: "Volitional", form: s + "よう" },
    ];
  }
  return [
    { label: "Dictionary", form: "くる" },
    { label: "Polite (ます)", form: "きます" },
    { label: "Negative (ない)", form: "こない" },
    { label: "Past (た)", form: "きた" },
    { label: "Te-form (て)", form: "きて" },
    { label: "Potential", form: "こられる" },
    { label: "Passive", form: "こられる" },
    { label: "Causative", form: "こさせる" },
    { label: "Volitional", form: "こよう" },
  ];
}

function iAdjForms(base: string): ConjugationForm[] | null {
  if (!base.endsWith("い")) return null;
  // いい / 良い are irregular: the stem becomes よ-.
  const yoi = base === "いい" || base.endsWith("良い");
  const stem = yoi ? base.slice(0, -2) + "よ" : base.slice(0, -1);
  return [
    { label: "Dictionary", form: base },
    { label: "Negative", form: stem + "くない" },
    { label: "Past", form: stem + "かった" },
    { label: "Negative past", form: stem + "くなかった" },
    { label: "Te-form", form: stem + "くて" },
    { label: "Adverbial", form: stem + "く" },
  ];
}

function naAdjForms(base: string): ConjugationForm[] {
  // Trim a trailing だ/な if the model included one.
  const stem = base.replace(/[だな]$/, "");
  return [
    { label: "Plain", form: stem + "だ" },
    { label: "Polite", form: stem + "です" },
    { label: "Negative", form: stem + "ではない" },
    { label: "Past", form: stem + "だった" },
    { label: "Te-form", form: stem + "で" },
    { label: "Adverbial", form: stem + "に" },
    { label: "Attributive", form: stem + "な" },
  ];
}

/**
 * Build a conjugation table for a saved item, or null if it doesn't apply.
 * Tries the written term first, then the kana reading (for godan/ichidan/i-adj
 * whose ending must be a valid kana).
 */
export function conjugate(
  term: string,
  reading: string | null | undefined,
  pos: string | null | undefined,
): ConjugationForm[] | null {
  const cls = classify(pos);
  if (!cls) return null;
  const t = (term ?? "").trim();
  const r = (reading ?? "").trim();
  if (!t) return null;

  switch (cls) {
    case "suru":
      return suruForms(t);
    case "kuru":
      return kuruForms(t);
    case "na-adj":
      return naAdjForms(t);
    case "godan":
      return godanForms(t) ?? (r ? godanForms(r) : null);
    case "ichidan":
      return ichidanForms(t) ?? (r ? ichidanForms(r) : null);
    case "i-adj":
      return iAdjForms(t) ?? (r ? iAdjForms(r) : null);
    default:
      return null;
  }
}

/** A short human label for the part of speech, for the flashcard chip. */
export function posLabel(pos: string | null | undefined): string | null {
  const p = (pos ?? "").trim();
  if (!p) return null;
  // Title-case the controlled vocabulary; leave anything else as-is.
  return p.charAt(0).toUpperCase() + p.slice(1);
}
