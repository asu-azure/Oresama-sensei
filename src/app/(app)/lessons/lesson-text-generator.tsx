"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Sparkles, PenLine } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";

export function LessonTextGenerator() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [deep, setDeep] = useState(false);
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  async function generate() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    setArticle("");
    setDone(false);
    setLessonId(null);
    try {
      const res = await fetch("/api/lesson/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, deep }),
      });
      if (!res.ok || !res.body) {
        throw new Error(
          (await res.text().catch(() => "")) || "Something went wrong.",
        );
      }
      setLessonId(res.headers.get("x-lesson-id"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        setArticle((a) => a + decoder.decode(value, { stream: true }));
      }
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PenLine className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Lesson from text</p>
          <p className="text-sm text-muted">
            Paste a sentence or passage — I&apos;ll turn it into a personalized
            lesson, no photo needed.
          </p>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            rows={3}
            placeholder="例：彼は約束を破ってばかりいる。— or paste a paragraph, a song lyric, a tweet…"
            className="mt-3 w-full resize-y rounded-xl border border-border bg-background px-3 py-2 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={deep}
                onChange={(e) => setDeep(e.target.checked)}
                disabled={busy}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              Deep lesson (slower, uses Opus)
            </label>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={generate} disabled={busy || !text.trim()}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy ? "Working…" : "Generate lesson"}
              </Button>
              <CostHint model={deep ? MODEL_LABELS.opus : MODEL_LABELS.sonnet} />
            </div>
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {(busy || article) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 border-t border-border pt-4"
        >
          {article ? (
            <Markdown>{article}</Markdown>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Writing your lesson…
            </p>
          )}
          {done && lessonId && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/lessons/${lessonId}`)}
              >
                Open saved lesson
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}