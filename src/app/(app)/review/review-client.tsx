"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, Brain, ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePlayer } from "@/components/exercises/exercise-player";
import { cn } from "@/lib/utils";
import { showReading } from "@/lib/furigana";
import { SpeakButton } from "@/components/speak-button";
import type { Rating } from "@/lib/srs";
import type { Exercise } from "@/lib/types";

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

export function ReviewClient({ cards }: { cards: ReviewCard[] }) {
  const [mode, setMode] = useState<"flash" | "test">("flash");
  const [testExercises, setTestExercises] = useState<Exercise[] | null>(null);
  const [loadingTest, setLoadingTest] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  async function startTest() {
    setLoadingTest(true);
    setTestError(null);
    try {
      const res = await fetch("/api/review-test", { method: "POST" });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || "Failed to generate a test.",
        );
      }
      const data = await res.json();
      setTestExercises((data.exercises ?? []) as Exercise[]);
      setMode("test");
    } catch (e) {
      setTestError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingTest(false);
    }
  }

  function gradeItem(itemId: string, correct: boolean) {
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, rating: correct ? "good" : "again" }),
    }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-border bg-surface p-0.5">
          <button
            onClick={() => setMode("flash")}
            className={tabCls(mode === "flash")}
          >
            <Brain className="h-4 w-4" /> Flashcards
          </button>
          <button
            onClick={() => {
              if (testExercises && testExercises.length > 0) setMode("test");
              else startTest();
            }}
            disabled={loadingTest}
            className={tabCls(mode === "test")}
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            Test
          </button>
        </div>
        {mode === "test" && testExercises && testExercises.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={startTest}
            disabled={loadingTest}
          >
            {loadingTest ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            New test
          </Button>
        )}
      </div>

      {testError && <p className="mb-3 text-sm text-accent">{testError}</p>}

      {mode === "test" ? (
        testExercises && testExercises.length > 0 ? (
          <ExercisePlayer
            exercises={testExercises}
            onGrade={gradeItem}
            onDone={() => setMode("flash")}
          />
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold">Practice test</h1>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Generate multiple-choice, sentence-arrangement, and
              fill-in-the-blank questions from the items you are due to review.
              Your answers update your spaced-repetition schedule.
            </p>
            <div className="mt-5">
              <Button onClick={startTest} disabled={loadingTest}>
                {loadingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  "Generate a test"
                )}
              </Button>
            </div>
          </div>
        )
      ) : (
        <Flashcards cards={cards} />
      )}
    </div>
  );
}

function tabCls(active: boolean): string {
  return cn(
    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
    active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
  );
}

function Flashcards({ cards }: { cards: ReviewCard[] }) {
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
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Done! 🎉</h1>
        <p className="mt-1 text-sm text-muted">
          You reviewed {reviewed} {reviewed === 1 ? "item" : "items"}.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/dashboard">
            <Button variant="outline">See progress</Button>
          </Link>
          <Link href="/chat">
            <Button>Keep studying</Button>
          </Link>
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
              {showReading(card.term, card.reading) && (
                <p className="font-jp text-lg text-muted">{card.reading}</p>
              )}
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
          {RATINGS.map((r) => (
            <button
              key={r.rating}
              onClick={() => grade(r.rating)}
              className={`rounded-xl px-2 py-3 text-sm font-medium transition-transform active:scale-95 ${r.cls}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}