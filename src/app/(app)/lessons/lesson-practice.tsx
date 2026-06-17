"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePlayer } from "@/components/exercises/exercise-player";
import type { Exercise } from "@/lib/types";
import { refineExercise } from "../tests/actions";

export function LessonPractice({
  lessonId,
  initialExercises,
}: {
  lessonId: string;
  initialExercises: Exercise[];
}) {
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playToken, setPlayToken] = useState(0);

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
        <Button variant="outline" size="sm" onClick={generate} disabled={busy}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {exercises.length > 0 ? "Regenerate" : "Generate"}
        </Button>
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
            onRefine={async (index, ex) => {
              const res = await refineExercise({
                exercise: ex,
                lessonId,
                index,
              });
              return "exercise" in res ? res.exercise : null;
            }}
          />
        ) : (
          <Button onClick={() => setPlaying(true)}>
            Start practice ({exercises.length})
          </Button>
        )}
      </div>
    </section>
  );
}