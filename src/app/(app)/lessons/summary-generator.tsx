"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, NotebookPen } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";

export function SummaryGenerator() {
  const router = useRouter();
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setArticle("");
    setDone(false);
    try {
      const res = await fetch("/api/summary", { method: "POST" });
      if (!res.ok || !res.body) {
        throw new Error(await res.text().catch(() => "Something went wrong."));
      }
      setLessonId(res.headers.get("x-lesson-id"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <NotebookPen className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Summary of everything</p>
            <p className="text-sm text-muted">
              Consolidate everything you&apos;ve saved into one themed review.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button onClick={generate} disabled={busy} variant="accent">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate"}
          </Button>
          <CostHint model={MODEL_LABELS.sonnet} />
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
              <Loader2 className="h-4 w-4 animate-spin" /> Reviewing your items…
            </p>
          )}
          {done && lessonId && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={() => router.push(`/lessons/${lessonId}`)}
              >
                Open saved summary
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
