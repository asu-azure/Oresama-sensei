"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";

export function LessonUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [deep, setDeep] = useState(false);
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "reading" | "writing" | "done">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);

  function pick(f: File | null) {
    setError(null);
    setArticle("");
    setLessonId(null);
    setStage("idle");
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  function reset() {
    pick(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function generate() {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setArticle("");
    setStage("reading");

    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("deep", String(deep));

      const res = await fetch("/api/lesson", { method: "POST", body: fd });
      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => "Something went wrong.");
        throw new Error(msg || "Something went wrong.");
      }
      setLessonId(res.headers.get("x-lesson-id"));
      setStage("writing");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setArticle((a) => a + decoder.decode(value, { stream: true }));
      }
      setStage("done");
      router.refresh(); // refresh the lesson list below
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />

      {!file && (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface px-6 py-12 text-center transition-colors hover:bg-surface-2"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="h-6 w-6" />
          </div>
          <span className="font-medium">Snap or upload a page</span>
          <span className="text-sm text-muted">
            A book page, manga panel, or worksheet — I&apos;ll turn it into a
            personalized lesson.
          </span>
        </button>
      )}

      {file && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-start gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {preview && (
              <img
                src={preview}
                alt="Selected page"
                className="h-28 w-28 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <label className="mt-2 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={deep}
                  onChange={(e) => setDeep(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                Deep lesson (slower, uses Opus for extra depth)
              </label>
              <div className="mt-3 flex gap-2">
                <Button onClick={generate} disabled={busy}>
                  {busy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {busy ? "Working…" : "Generate lesson"}
                </Button>
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  <X className="h-4 w-4" /> Clear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      {(stage === "reading" || stage === "writing" || article) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-border bg-surface p-5"
        >
          {stage === "reading" && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading the page…
            </p>
          )}
          {article && <Markdown>{article}</Markdown>}
          {stage === "done" && lessonId && (
            <div className="mt-4 border-t border-border pt-4">
              <Button variant="outline" onClick={() => router.push(`/lessons/${lessonId}`)}>
                Open saved lesson
              </Button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
