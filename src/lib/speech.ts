// Japanese read aloud with the browser's own speech synthesis (free, no API).
// A no-op where speechSynthesis is missing.

import { stripFurigana } from "./furigana";

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak `text` in Japanese. Resolves when it finishes (or fails). */
export function speak(text: string): Promise<void> {
  if (!canSpeak() || !text) return Promise.resolve();
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(stripFurigana(text));
  u.lang = "ja-JP";
  u.rate = 0.95;
  const voice = synth.getVoices().find((v) => v.lang === "ja-JP" || v.lang.startsWith("ja"));
  if (voice) u.voice = voice;
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}
