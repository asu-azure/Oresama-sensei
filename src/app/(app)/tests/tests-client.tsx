"use client";

import { useState } from "react";
import {
  GraduationCap,
  Loader2,
  Play,
  Trash2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExercisePlayer } from "@/components/exercises/exercise-player";
import { cn, formatDate } from "@/lib/utils";
import type { Exercise } from "@/lib/types";
import { refineExercise } from "./actions";

export type SavedTestRow = {
  id: string;
  title: string;
  scope: string;
  meta: { level?: string | null; type?: string | null; item_count?: number } | null;
  created_at: string;
  last_used_at: string | null;
  used_count: number;
};

type Counts = { struggling: number; new: number; due: number };
type Scope = "struggling" | "new" | "due" | "filter";

const SCOPES: { key: Scope; label: string; hint: string }[] = [
  { key: "struggling", label: "Struggling", hint: "your hardest items" },
  { key: "new", label: "New", hint: "never practiced" },
  { key: "due", label: "Due now", hint: "scheduled for review" },
  { key: "filter", label: "By level / type", hint: "choose an area" },
];

const TYPES = ["vocab", "grammar", "expression"];

export function TestsClient({
  counts,
  levels,
  saved,
}: {
  counts: Counts;
  levels: string[];
  saved: SavedTestRow[];
}) {
  const [savedList, setSavedList] = useState<SavedTestRow[]>(saved);
  const [scope, setScope] = useState<Scope>("struggling");
  const [level, setLevel] = useState<string>("");
  const [type, setType] = useState<string>("");

  const [phase, setPhase] = useState<"browse" | "playing">("browse");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [playingTestId, setPlayingTestId] = useState<string | null>(null);
  const [playToken, setPlayToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function gradeItem(itemId: string, correct: boolean) {
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, rating: correct ? "good" : "again" }),
    }).catch(() => {});
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          level: scope === "filter" && level ? level : undefined,
          type: scope === "filter" && type ? type : undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || "Failed to generate a test.",
        );
      }
      const data = await res.json();
      setExercises((data.exercises ?? []) as Exercise[]);
      setPlayingTestId(data.id ?? null);
      setPlayToken((t) => t + 1);
      setPhase("playing");
      if (data.id) {
        setSavedList((prev) => [
          {
            id: data.id,
            title: data.title,
            scope,
            meta: data.meta ?? { level: level || null, type: type || null },
            created_at: new Date().toISOString(),
            last_used_at: null,
            used_count: 0,
          },
          ...prev,
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function replay(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tests/${id}`);
      if (!res.ok) throw new Error("Couldn't load that test.");
      const data = await res.json();
      setExercises((data.test?.exercises ?? []) as Exercise[]);
      setPlayingTestId(id);
      setPlayToken((t) => t + 1);
      setPhase("playing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    setSavedList((prev) => prev.filter((t) => t.id !== id));
    fetch(`/api/tests/${id}`, { method: "DELETE" }).catch(() => {});
  }

  if (phase === "playing") {
    return (
      <div className="mx-auto max-w-lg py-6">
        <button
          onClick={() => setPhase("browse")}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tests
        </button>
        <ExercisePlayer
          key={playToken}
          exercises={exercises}
          onGrade={gradeItem}
          onDone={() => setPhase("browse")}
          onRefine={async (index, ex) => {
            const res = await refineExercise({
              exercise: ex,
              testId: playingTestId ?? undefined,
              index,
            });
            return "exercise" in res ? res.exercise : null;
          }}
        />
      </div>
    );
  }

  const count = (s: Scope) =>
    s === "filter" ? null : counts[s as keyof Counts];

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">Tests</h1>
        <p className="mt-1 text-sm text-muted">
          Generate a focused practice test, or replay a saved one for free.
          Answers update your review schedule.
        </p>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      {/* New test */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" /> New test
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SCOPES.map((s) => {
            const c = count(s.key);
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <div className="flex items-baseline justify-between gap-1">
                  <span className="text-sm font-medium">{s.label}</span>
                  {c !== null && (
                    <span className="text-xs tabular-nums text-muted">{c}</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted">{s.hint}</p>
              </button>
            );
          })}
        </div>

        {scope === "filter" && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Any level</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm capitalize outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Any type</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <Button onClick={generate} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" /> Generate test
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Saved tests */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">
          Saved tests {savedList.length > 0 && `(${savedList.length})`}
        </h2>
        {savedList.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
            Tests you generate are saved here so you can retake them anytime —
            free, no new generation.
          </p>
        ) : (
          <ul className="space-y-2">
            {savedList.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted">
                    {formatDate(t.created_at)}
                    {t.meta?.item_count ? ` · ${t.meta.item_count} items` : ""}
                    {t.used_count > 0 ? ` · taken ${t.used_count}×` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => replay(t.id)}
                  disabled={busy}
                >
                  <Play className="h-4 w-4" /> Play
                </Button>
                <button
                  onClick={() => remove(t.id)}
                  aria-label="Delete test"
                  className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-accent"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
