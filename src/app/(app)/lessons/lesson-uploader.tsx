"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Sparkles, X, Plus, ImagePlus } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { GeometricLoader } from "@/components/geometric-loader";
import { cn } from "@/lib/utils";
import {
  UPLOAD_MATERIAL_TYPES,
  collectionKindForMaterial,
  type MaterialType,
} from "@/lib/source";
import { listCollections } from "./collections-actions";
import type { CollectionOption } from "@/lib/collections";

const MAX_IMAGES = 6;
type OcrModel = "auto" | "gemini" | "claude";
const OCR_OPTIONS: { value: OcrModel; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

type Pic = { file: File; url: string };

const NEW_COLLECTION = "__new__";

export function LessonUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pics, setPics] = useState<Pic[]>([]);
  const [deep, setDeep] = useState(false);
  const [ocrModel, setOcrModel] = useState<OcrModel>("gemini");

  // Source / collection metadata
  const [materialType, setMaterialType] = useState<MaterialType>("textbook");
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [collectionId, setCollectionId] = useState<string>(NEW_COLLECTION);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [cover, setCover] = useState<Pic | null>(null);
  const [pageStart, setPageStart] = useState("");
  const [pageEnd, setPageEnd] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const collectionKind = collectionKindForMaterial(materialType);
  const kindCollections = collections.filter((c) => c.kind === collectionKind);

  async function pickMaterial(m: MaterialType) {
    setMaterialType(m);
    const kind = collectionKindForMaterial(m);
    let list = collections;
    if (kind && collections.length === 0) {
      list = await listCollections().catch(() => []);
      setCollections(list);
    }
    // Default to the most recent existing collection of this kind, else "new".
    const firstOfKind = list.find((c) => c.kind === kind);
    setCollectionId(firstOfKind ? firstOfKind.id : NEW_COLLECTION);
  }

  function pickCover(list: FileList | null) {
    const f = list?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    if (cover) URL.revokeObjectURL(cover.url);
    setCover({ file: f, url: URL.createObjectURL(f) });
  }
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<"idle" | "reading" | "writing" | "done">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    setError(null);
    setArticle("");
    setLessonId(null);
    setStage("idle");
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (incoming.length === 0) {
      setError("Please choose image files (PNG, JPG, or WebP).");
      return;
    }
    // Load existing collections the first time pages appear, so the default
    // material type ("Textbook") immediately offers the user's saved books.
    if (pics.length === 0 && collectionKind) void pickMaterial(materialType);
    setPics((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (next.length >= MAX_IMAGES) break;
        next.push({ file: f, url: URL.createObjectURL(f) });
      }
      return next;
    });
  }

  function removeAt(i: number) {
    setPics((prev) => {
      const url = prev[i]?.url;
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function reset() {
    pics.forEach((p) => URL.revokeObjectURL(p.url));
    if (cover) URL.revokeObjectURL(cover.url);
    setPics([]);
    setCover(null);
    setNewTitle("");
    setNewAuthor("");
    setPageStart("");
    setPageEnd("");
    setArticle("");
    setLessonId(null);
    setStage("idle");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  async function generate() {
    if (pics.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setArticle("");
    setStage("reading");

    try {
      const fd = new FormData();
      pics.forEach((p) => fd.append("images", p.file));
      fd.append("deep", String(deep));
      fd.append("ocrModel", ocrModel);
      fd.append("materialType", materialType);
      if (collectionKind) {
        if (collectionId !== NEW_COLLECTION) {
          fd.append("collectionId", collectionId);
        } else if (newTitle.trim()) {
          fd.append("collectionTitle", newTitle.trim());
          if (newAuthor.trim()) fd.append("collectionAuthor", newAuthor.trim());
          if (cover) fd.append("cover", cover.file);
        }
        if (pageStart.trim()) fd.append("pageStart", pageStart.trim());
        if (pageEnd.trim()) fd.append("pageEnd", pageEnd.trim());
      }

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
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* No `capture` attribute → iOS offers Photo Library / Take Photo / Browse */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      {pics.length === 0 && (
        <button
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
            dragOver
              ? "border-primary bg-surface-2"
              : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="h-6 w-6" />
          </div>
          <span className="font-medium">
            {dragOver ? "Drop the images here" : "Snap, upload, or drag pages"}
          </span>
          <span className="text-sm text-muted">
            Take photos, pick from your camera roll, or drag &amp; drop — one or
            several pages (a book, manga panels, or a worksheet). I&apos;ll turn
            them into one personalized lesson.
          </span>
        </button>
      )}

      {pics.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          {/* Thumbnail strip */}
          <div className="flex flex-wrap gap-2">
            {pics.map((p, i) => (
              <div key={p.url} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Page ${i + 1}`}
                  className="h-20 w-20 rounded-lg object-cover"
                />
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                  {i + 1}
                </span>
                <button
                  onClick={() => removeAt(i)}
                  disabled={busy}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow disabled:opacity-50"
                  aria-label={`Remove page ${i + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pics.length < MAX_IMAGES && (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span className="text-[10px]">Add</span>
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-muted">
            {pics.length} page{pics.length > 1 ? "s" : ""} · max {MAX_IMAGES}
          </p>

          {/* Material type */}
          <div className="mt-3">
            <span className="text-sm text-muted">What is this from?</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {UPLOAD_MATERIAL_TYPES.map((m) => (
                <button
                  key={m.value}
                  onClick={() => pickMaterial(m.value)}
                  disabled={busy}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors disabled:opacity-50",
                    materialType === m.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:bg-surface-2",
                  )}
                >
                  <span className="mr-1">{m.emoji}</span>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Collection (book / game / series): select existing or add new */}
          {collectionKind && (
            <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface-2/50 p-3">
              <label className="block text-sm text-muted">
                {collectionKind === "game"
                  ? "Which game?"
                  : collectionKind === "series"
                    ? "Which series?"
                    : "Which book?"}
              </label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {kindCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value={NEW_COLLECTION}>➕ Add new…</option>
              </select>

              {collectionId === NEW_COLLECTION && (
                <div className="space-y-2">
                  <input
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    disabled={busy}
                    placeholder="Title (e.g. 新完全マスター N2 読解)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    disabled={busy}
                    placeholder="Author / studio (optional)"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => pickCover(e.target.files)}
                  />
                  <div className="flex items-center gap-2">
                    {cover ? (
                      <div className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover.url}
                          alt="Cover"
                          className="h-16 w-12 rounded object-cover"
                        />
                        <button
                          onClick={() => {
                            URL.revokeObjectURL(cover.url);
                            setCover(null);
                          }}
                          disabled={busy}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow disabled:opacity-50"
                          aria-label="Remove cover"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => coverInputRef.current?.click()}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 disabled:opacity-50"
                      >
                        <ImagePlus className="h-4 w-4" /> Add cover
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Pages</span>
                <input
                  value={pageStart}
                  onChange={(e) => setPageStart(e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="from"
                  className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted">–</span>
                <input
                  value={pageEnd}
                  onChange={(e) => setPageEnd(e.target.value)}
                  disabled={busy}
                  inputMode="numeric"
                  placeholder="to (opt.)"
                  className="w-24 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {/* OCR model picker */}
          <div className="mt-3">
            <span className="text-sm text-muted">Read with</span>
            <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-border">
              {OCR_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setOcrModel(o.value)}
                  disabled={busy}
                  className={cn(
                    "px-3 py-1 text-sm transition-colors disabled:opacity-50",
                    ocrModel === o.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted hover:bg-surface-2",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              Gemini is fastest &amp; cheapest. <b>Auto</b> uses Gemini and falls
              back to Claude if it&apos;s busy.
            </p>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
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
                <GeometricLoader size={18} />
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
              <GeometricLoader size={20} />
              Reading {pics.length > 1 ? `${pics.length} pages` : "the page"}…
            </p>
          )}
          {article && <Markdown>{article}</Markdown>}
          {stage === "done" && lessonId && (
            <div className="mt-4 border-t border-border pt-4">
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
