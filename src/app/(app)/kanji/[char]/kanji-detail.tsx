"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, Check, Lightbulb } from "lucide-react";
import { StrokeOrder } from "@/components/kanji/stroke-order";
import { SpeakButton } from "@/components/speak-button";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { GeometricLoader } from "@/components/geometric-loader";
import { cn } from "@/lib/utils";
import { levelOf, isKanji, type KanjiInfo, type KanjiStrokes } from "@/lib/kanji";
import { getOrGenerateMnemonic, setLearned } from "../actions";

export type ExampleWord = {
  id: string;
  term: string;
  reading: string | null;
  meaning: string | null;
};

export function KanjiDetail({
  char,
  info,
  strokes,
  examples,
  initialMnemonic,
  initialLearned,
  autoLearned = false,
}: {
  char: string;
  info: KanjiInfo | null;
  strokes: KanjiStrokes | null;
  examples: ExampleWord[];
  initialMnemonic: string | null;
  initialLearned: boolean;
  autoLearned?: boolean;
}) {
  // Best reading to speak: a kun (okurigana dots stripped), else on, else the kanji.
  const speakText =
    info?.kun[0]?.replace(/[.\-]/g, "") || info?.on[0] || char;

  const [mnemonic, setMnemonic] = useState<string | null>(initialMnemonic);
  const [generating, setGenerating] = useState(false);
  const [mnemonicError, setMnemonicError] = useState<string | null>(null);
  const [learned, setLearnedState] = useState(initialLearned);
  // Effective state shown on the card: an explicit mark OR auto (a word mastered).
  const effectiveLearned = learned || autoLearned;

  async function generate() {
    setGenerating(true);
    setMnemonicError(null);
    const res = await getOrGenerateMnemonic(char);
    if ("mnemonic" in res) setMnemonic(res.mnemonic);
    else setMnemonicError(res.error);
    setGenerating(false);
  }

  function toggleLearned() {
    const next = !learned;
    setLearnedState(next);
    setLearned(char, next).catch(() => setLearnedState(!next));
  }

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/kanji"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All kanji
        </Link>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={toggleLearned}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              effectiveLearned
                ? "border-emerald-600/40 bg-emerald-600/10 text-emerald-700"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <Check className="h-4 w-4" />{" "}
            {effectiveLearned ? "Learned" : "Mark learned"}
          </button>
          {autoLearned && !learned && (
            <span className="text-[11px] text-muted">
              auto · a word reached mastery
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[200px_1fr]">
        {/* Stroke order */}
        <div className="mx-auto w-full max-w-[220px]">
          {strokes && strokes.strokes.length > 0 ? (
            <StrokeOrder
              key={char}
              strokes={strokes.strokes}
              className="rounded-2xl border border-border bg-surface"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-2xl border border-border bg-surface font-jp text-7xl">
              {char}
            </div>
          )}
        </div>

        {/* Facts */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-jp text-4xl font-semibold">{char}</span>
            <SpeakButton text={speakText} />
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {info?.jlpt && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  {info.jlpt}
                </span>
              )}
              {info?.strokes != null && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                  {info.strokes} strokes
                </span>
              )}
              {info?.grade != null && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                  grade {info.grade}
                </span>
              )}
            </div>
          </div>

          {info?.meanings && info.meanings.length > 0 && (
            <p className="text-sm">{info.meanings.join(", ")}</p>
          )}

          {info && (
            <div className="space-y-1 text-sm">
              {info.kun.length > 0 && (
                <p>
                  <span className="text-muted">kun </span>
                  <span className="font-jp">{info.kun.join("、")}</span>
                </p>
              )}
              {info.on.length > 0 && (
                <p>
                  <span className="text-muted">on </span>
                  <span className="font-jp">{info.on.join("、")}</span>
                </p>
              )}
            </div>
          )}

          {!info && (
            <p className="text-sm text-muted">
              This kanji isn&apos;t in the JLPT set, so there&apos;s no reading
              data — but your saved words using it are below.
            </p>
          )}
        </div>
      </div>

      {/* Components */}
      {strokes && strokes.components.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Built from</h2>
          <div className="flex flex-wrap gap-2">
            {strokes.components.map((c, i) => {
              const linkable = isKanji(c.el) && !!levelOf(c.el);
              const inner = (
                <span className="flex items-center gap-1.5">
                  <span className="font-jp text-xl">{c.el}</span>
                  {c.isRadical && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      radical
                    </span>
                  )}
                </span>
              );
              return linkable ? (
                <Link
                  key={i}
                  href={`/kanji/${encodeURIComponent(c.el)}`}
                  className="rounded-xl border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-2"
                >
                  {inner}
                </Link>
              ) : (
                <span
                  key={i}
                  className="rounded-xl border border-border bg-surface px-3 py-2"
                >
                  {inner}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Personalized mnemonic */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-muted">
          <Lightbulb className="h-4 w-4 text-primary" /> Mnemonic
        </h2>
        {mnemonic ? (
          <div className="space-y-2">
            <div className="text-sm">
              <Markdown>{mnemonic}</Markdown>
            </div>
            <button
              onClick={generate}
              disabled={generating}
              className="text-xs text-muted underline transition-colors hover:text-foreground disabled:opacity-50"
            >
              {generating ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-muted">
              Get a vivid memory story built from {char}&apos;s parts and tailored
              to you.
            </p>
            <Button size="sm" onClick={generate} disabled={generating}>
              {generating ? (
                <>
                  <GeometricLoader size={16} /> Generating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Generate mnemonic
                </>
              )}
            </Button>
          </div>
        )}
        {mnemonicError && (
          <p className="mt-2 text-xs text-accent">{mnemonicError}</p>
        )}
      </section>

      {/* Example words from the learner's library */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">
          Your words with {char}
        </h2>
        {examples.length === 0 ? (
          <p className="text-sm text-muted">
            None saved yet — words you learn that use {char} will show here.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {examples.map((w) => (
              <li key={w.id}>
                <Link
                  href={`/review?item=${w.id}`}
                  className={cn(
                    "block rounded-xl border border-border bg-surface px-3 py-2 transition-colors hover:bg-surface-2",
                  )}
                >
                  <span className="font-jp text-base">{w.term}</span>
                  {w.reading && (
                    <span className="ml-2 font-jp text-sm text-muted">
                      {w.reading}
                    </span>
                  )}
                  {w.meaning && (
                    <span className="ml-2 text-sm text-muted">
                      — {w.meaning}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
