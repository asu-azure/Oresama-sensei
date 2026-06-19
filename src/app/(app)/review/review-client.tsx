"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, Brain, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskSensei } from "@/components/ask-sensei/ask-sensei";
import { showReading } from "@/lib/furigana";
import { SpeakButton } from "@/components/speak-button";
import { PitchAccent } from "@/components/pitch-accent";
import { PitchToggle } from "@/components/pitch-toggle";
import { PitchLegend } from "@/components/pitch-legend";
import { usePitch } from "@/lib/use-pitch";
import type { Rating, IntervalPreview } from "@/lib/srs";

export type ReviewCard = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
};

const RATINGS: { rating: Rating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "bg-accent text-white" },
  { rating: "hard", label: "Hard", cls: "bg-surface-2 text-foreground" },
  { rating: "good", label: "Good", cls: "bg-primary text-primary-foreground" },
  { rating: "easy", label: "Easy", cls: "bg-emerald-600 text-white" },
];

export function ReviewClient({
  cards,
  previews = {},
  totalDue,
}: {
  cards: ReviewCard[];
  previews?: Record<string, IntervalPreview>;
  totalDue?: number;
}) {
  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Brain className="h-5 w-5 text-primary" /> Review
        </h1>
        <div className="flex items-center gap-2">
          <PitchToggle />
          <Link
            href="/tests"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <GraduationCap className="h-4 w-4" /> Practice tests
          </Link>
        </div>
      </div>
      <PitchLegend className="mb-4" />
      <Flashcards
        cards={cards}
        previews={previews}
        totalDue={totalDue ?? cards.length}
      />
    </div>
  );
}

function Flashcards({
  cards,
  previews,
  totalDue,
}: {
  cards: ReviewCard[];
  previews: Record<string, IntervalPreview>;
  totalDue: number;
}) {
  const pitchOn = usePitch();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  if (cards.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Nothing due right now</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          You are all caught up. New items become reviewable as you chat and make
          lessons; scheduled ones come back when they are due. You can still
          generate a practice test above.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/chat">
            <Button>Study something new</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (index >= cards.length) {
    // Cards just graded are rescheduled into the future, so anything still due
    // is beyond this batch. Force a fresh load to pull the next due cards.
    const remaining = Math.max(0, totalDue - reviewed);
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Done! 🎉</h1>
        <p className="mt-1 text-sm text-muted">
          You reviewed {reviewed} {reviewed === 1 ? "item" : "items"}.
          {remaining > 0
            ? ` ${remaining} still due.`
            : " You're all caught up."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline">See progress</Button>
          </Link>
          {remaining > 0 ? (
            <Button onClick={() => window.location.assign("/review")}>
              Keep studying ({remaining} due)
            </Button>
          ) : (
            <Link href="/chat">
              <Button>Study something new</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const card = cards[index];

  function grade(rating: Rating) {
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: card.id, rating }),
    }).catch(() => {});
    setReviewed((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>
          Review · {index + 1} / {cards.length}
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> spaced repetition
        </span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-border bg-surface p-8 text-center"
        >
          <div className="mb-3 flex justify-center gap-2 text-xs">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
              {card.type}
            </span>
            {card.jlpt_level && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {card.jlpt_level}
              </span>
            )}
          </div>

          <div className="font-jp text-3xl font-semibold">{card.term}</div>
          <div className="mt-2 flex justify-center">
            <SpeakButton text={card.reading || card.term} />
          </div>

          {revealed ? (
            <div className="mt-5 space-y-2 text-left">
              {showReading(card.term, card.reading) &&
                (pitchOn ? (
                  <PitchAccent
                    term={card.term}
                    reading={card.reading!}
                    className="text-lg text-muted"
                  />
                ) : (
                  <p className="font-jp text-lg text-muted">{card.reading}</p>
                ))}
              {card.meaning && <p className="text-base">{card.meaning}</p>}
              {card.example && (
                <p className="font-jp text-sm text-muted">{card.example}</p>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <Button onClick={() => setRevealed(true)} size="lg">
                Show answer
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map((r) => {
            const eta = previews[card.id]?.[r.rating];
            return (
              <button
                key={r.rating}
                onClick={() => grade(r.rating)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-transform active:scale-95 ${r.cls}`}
              >
                {r.label}
                {eta && (
                  <span className="text-[10px] font-normal opacity-80">
                    {eta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <AskSensei
        context={{
          kind: "vocab",
          item: {
            type: card.type,
            term: card.term,
            reading: card.reading,
            meaning: card.meaning,
            example: card.example,
            jlpt_level: card.jlpt_level,
          },
        }}
        contextKey={`card-${card.id}`}
        suggestions={[
          "Explain this word in depth.",
          "Give me another example sentence.",
          "What's an easy way to remember this?",
        ]}
      />
    </>
  );
}