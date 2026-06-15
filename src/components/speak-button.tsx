"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { stripFurigana } from "@/lib/furigana";
import { cn } from "@/lib/utils";

/** Tiny speaker button that reads Japanese aloud via the browser's built-in
 *  speech synthesis (free, no API). No-op where speechSynthesis is unavailable. */
export function SpeakButton({
  text,
  className,
  label = "Play pronunciation",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [speaking, setSpeaking] = useState(false);

  function speak(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(stripFurigana(text));
    u.lang = "ja-JP";
    u.rate = 0.95;
    const voice = synth
      .getVoices()
      .find((v) => v.lang === "ja-JP" || v.lang.startsWith("ja"));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  }

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95",
        speaking && "text-primary",
        className,
      )}
    >
      <Volume2 className="h-4 w-4" />
    </button>
  );
}