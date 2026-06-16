"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StrokeOrder } from "@/components/kanji/stroke-order";
import { SpeakButton } from "@/components/speak-button";
import { cn } from "@/lib/utils";
import { levelOf, isKanji, type KanjiInfo, type KanjiStrokes } from "@/lib/kanji";

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
}: {
  char: string;
  info: KanjiInfo | null;
  strokes: KanjiStrokes | null;
  examples: ExampleWord[];
}) {
  // Best reading to speak: a kun (okurigana dots stripped), else on, else the kanji.
  const speakText =
    info?.kun[0]?.replace(/[.\-]/g, "") || info?.on[0] || char;

  return (
    <div className="space-y-5 py-4">
      <Link
        href="/kanji"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All kanji
      </Link>

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
