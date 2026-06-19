"use client";

import { useState } from "react";
import { Compass, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { RubyText } from "@/components/ruby-text";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { cn } from "@/lib/utils";

export type CoachFocus = { label: string; why: string; action: string };
export type CoachNoteData = {
  summary_md: string;
  focus_areas?: CoachFocus[] | null;
  generated_at?: string;
};

/** AI study-coach note. Shows a cached note instantly when available; otherwise a
 *  button to generate one. The server caches by weakness "signature", so repeated
 *  clicks don't re-bill unless the picture changed (or the user forces a refresh). */
export function CoachNote({ initial }: { initial: CoachNoteData | null }) {
  const [note, setNote] = useState<CoachNoteData | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function fetchNote(force: boolean) {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/insights/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as CoachNoteData & { empty?: boolean };
      if (data.empty || !data.summary_md) {
        setNote(null);
        setError(true);
      } else {
        setNote(data);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-muted">
          <Compass className="h-4 w-4 text-primary" /> Coach&apos;s note
        </h2>
        {note && (
          <div className="flex items-center gap-2">
            <CostHint model={MODEL_LABELS.engine} />
            <button
              onClick={() => fetchNote(true)}
              disabled={loading}
              title="Regenerate"
              className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {note ? (
        <div className="space-y-4">
          <Markdown className="text-sm">{note.summary_md}</Markdown>
          {(note.focus_areas ?? []).length > 0 && (
            <ul className="space-y-2">
              {(note.focus_areas ?? []).map((f, i) => (
                <li
                  key={i}
                  className="rounded-xl border border-border bg-surface-2/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {f.label}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted">
                    <RubyText>{f.why}</RubyText>
                  </p>
                  <p className="mt-1 flex items-start gap-1.5 text-sm">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      <RubyText>{f.action}</RubyText>
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="text-sm text-muted">
          <p>
            Get a quick, personalized read on what to focus on next — drawn from
            your strengths and weak spots.
          </p>
          {error && (
            <p className="mt-2 text-accent">
              Couldn&apos;t generate coaching right now. Try again, or study a
              little more first.
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => fetchNote(false)}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Compass className="h-4 w-4" />
              )}
              {loading ? "Thinking…" : "Get coaching"}
            </button>
            <CostHint model={MODEL_LABELS.engine} />
          </div>
        </div>
      )}
    </section>
  );
}
