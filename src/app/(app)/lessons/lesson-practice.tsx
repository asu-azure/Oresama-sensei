"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePlayer } from "@/components/exercises/exercise-player";
import { AskSensei } from "@/components/ask-sensei/ask-sensei";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import type { AskContext, Exercise } from "@/lib/types";
import { refineExercise } from "../tests/actions";

export function LessonPractice({
  lessonId,
  lessonTitle,
  lessonExcerpt,
  initialExercises,
}: {
  lessonId: string;
  lessonTitle?: string | null;
  lessonExcerpt?: string | null;
  initialExercises: Exercise[];
}) {
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // One floating helper: it answers about the current exercise while practicing,
  // otherwise about the lesson as a whole.
  const askContext: AskContext =
    playing && exercises[activeIndex]
      ? { kind: "exercise", exercise: exercises[activeIndex] }
      : { kind: "lesson", title: lessonTitle, excerpt: lessonExcerpt };
  const askKey =
    playing && exercises[activeIndex]
      ? `lesson-ex-${playToken}-${activeIndex}`
      : `lesson-${lessonId}`;

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/lesson/${lessonId}/exercises`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || "Could not generate exercises.",
        );
      }
      const data = await res.json();
      setExercises((data.exercises ?? []) as Exercise[]);
      setPlayToken((t) => t + 1);
      setPlaying(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-jp text-lg font-semibold">練習 (Practice)</h2>
        <div className="flex flex-col items-end gap-1">
          <Button variant="outline" size="sm" onClick={generate} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {exercises.length > 0 ? "Regenerate" : "Generate"}
          </Button>
          <CostHint model={MODEL_LABELS.sonnet} />
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-accent">{error}</p>}

      <div className="mt-4">
        {exercises.length === 0 ? (
          <p className="text-sm text-muted">
            No exercises yet. Click Generate to create multiple-choice,
            sentence-arrangement, and fill-in-the-blank practice from this lesson.
          </p>
        ) : playing ? (
          <ExercisePlayer
            key={playToken}
            exercises={exercises}
            onDone={() => setPlaying(false)}
            onIndexChange={setActiveIndex}
            onRefine={async (index, ex, note) => {
              const res = await refineExercise({
                exercise: ex,
                lessonId,
                index,
                note,
              });
              return "exercise" in res ? res.exercise : null;
            }}
          />
        ) : (
          <Button
            onClick={() => {
              setActiveIndex(0);
              setPlaying(true);
            }}
          >
            Start practice ({exercises.length})
          </Button>
        )}
      </div>

      <AskSensei context={askContext} contextKey={askKey} />
    </section>
  );
}