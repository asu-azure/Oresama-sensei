"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Camera, Sparkles, X, Plus, ImagePlus } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { GeometricLoader } from "@/components/geometric-loader";
import { CostHint, lessonModelLabel } from "@/components/cost-hint";
import { cn } from "@/lib/utils";
import {
  UPLOAD_MATERIAL_TYPES,
  collectionKindForMaterial,
  type MaterialType,
} from "@/lib/source";
import { listCollections } from "./collections-actions";
import { createClient } from "@/lib/supabase/client";
import type { CollectionOption } from "@/lib/collections";

const MAX_IMAGES = 6;
const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per image (matches the API guard)
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
type OcrModel = "auto" | "gemini" | "claude";
const OCR_OPTIONS: { value: OcrModel; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "gemini", label: "Gemini" },
  { value: "claude", label: "Claude" },
];

// Mirrors LessonModelChoice in lib/claude (kept local so this client component
// doesn't pull in the server SDK).
type LessonModelChoice = "claude" | "opus" | "gemini" | "gemini-pro";
const LESSON_MODEL_OPTIONS: { value: LessonModelChoice; label: string }[] = [
  { value: "gemini", label: "Quick" },
  { value: "gemini-pro", label: "Quick+" },
  { value: "claude", label: "Standard" },
  { value: "opus", label: "Deep" },
];

type Pic = { file: File; url: string };

const NEW_COLLECTION = "__new__";

/** Remember the last-used book in a cookie so the server can pre-select it next
 *  time (no effect / no hydration mismatch). "Add new" is never remembered. */
function rememberBook(material: MaterialType, collectionId: string) {
  if (typeof document === "undefined" || collectionId === NEW_COLLECTION) return;
  const v = encodeURIComponent(JSON.stringify({ material, collectionId }));
  document.cookie = `lastBook=${v}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

export function LessonUploader({
  initialMaterial = null,
  initialCollectionId = null,
  initialPage = null,
  initialCollections = [],
}: {
  initialMaterial?: MaterialType | null;
  initialCollectionId?: string | null;
  initialPage?: string | null;
  initialCollections?: CollectionOption[];
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pics, setPics] = useState<Pic[]>([]);
  const [lessonModel, setLessonModel] = useState<LessonModelChoice>("claude");
  const [ocrModel, setOcrModel] = useState<OcrModel>("gemini");

  // Source / collection metadata. Seeded from the server (URL prefill from a
  // book page, or the remembered last book) so the right book is pre-selected.
  const [materialType, setMaterialType] = useState<MaterialType>(
    initialMaterial ?? "textbook",
  );
  const [collections, setCollections] =
    useState<CollectionOption[]>(initialCollections);
  const [collectionId, setCollectionId] = useState<string>(() => {
    if (initialCollectionId) return initialCollectionId;
    const kind = collectionKindForMaterial(initialMaterial ?? "textbook");
    const first = initialCollections.find((c) => c.kind === kind);
    return first ? first.id : NEW_COLLECTION;
  });
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [cover, setCover] = useState<Pic | null>(null);
  const [pageStart, setPageStart] = useState(initialPage ?? "");
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
    const cid = firstOfKind ? firstOfKind.id : NEW_COLLECTION;
    setCollectionId(cid);
    rememberBook(m, cid);
  }

  function selectCollection(cid: string) {
    setCollectionId(cid);
    rememberBook(materialType, cid);
  }

  function pickCover(list: FileList | null) {
    const f = list?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    if (cover) URL.revokeObjectURL(cover.url);
    setCover({ file: f, url: URL.createObjectURL(f) });
  }
  const [article, setArticle] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<
    "idle" | "uploading" | "reading" | "writing" | "done"
  >("idle");
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
    // Lazy-load collections the first time pages appear ONLY if the server
    // didn't already provide them (otherwise we'd clobber a prefilled selection).
    if (pics.length === 0 && collectionKind && collections.length === 0)
      void pickMaterial(materialType);
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

    // Validate up front so a bad file fails before anything is uploaded.
    for (const p of pics) {
      if (!EXT[p.file.type]) {
        setError("Please use PNG, JPG, or WebP images.");
        return;
      }
      if (p.file.size > MAX_BYTES) {
        setError("Each image must be under 12 MB.");
        return;
      }
    }

    setBusy(true);
    setError(null);
    setArticle("");
    setStage("uploading");

    try {
      // Upload pages straight to Supabase Storage from the browser (scoped to
      // the user's folder by RLS), then send only the small paths to the API.
      // This bypasses the serverless request-body size limit that made
      // multi-page uploads fail with "payload too large".
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You need to be signed in to upload.");

      const uploaded = await Promise.all(
        pics.map(async (p) => {
          const path = `${user.id}/${crypto.randomUUID()}.${EXT[p.file.type]}`;
          const { error: upErr } = await supabase.storage
            .from("lesson-images")
            .upload(path, p.file, { contentType: p.file.type, upsert: false });
          if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
          return { path, mime: p.file.type };
        }),
      );

      let coverPath: string | null = null;
      if (collectionKind && collectionId === NEW_COLLECTION && cover && EXT[cover.file.type]) {
        const cp = `${user.id}/covers/${crypto.randomUUID()}.${EXT[cover.file.type]}`;
        const { error: cErr } = await supabase.storage
          .from("lesson-images")
          .upload(cp, cover.file, { contentType: cover.file.type, upsert: false });
        if (!cErr) coverPath = cp;
      }

      const body: Record<string, unknown> = {
        imagePaths: uploaded.map((u) => u.path),
        mimeTypes: uploaded.map((u) => u.mime),
        lessonModel,
        ocrModel,
        materialType,
      };
      if (collectionKind) {
        if (collectionId !== NEW_COLLECTION) {
          body.collectionId = collectionId;
        } else if (newTitle.trim()) {
          body.collectionTitle = newTitle.trim();
          if (newAuthor.trim()) body.collectionAuthor = newAuthor.trim();
          if (coverPath) body.coverPath = coverPath;
        }
        if (pageStart.trim()) body.pageStart = pageStart.trim();
        if (pageEnd.trim()) body.pageEnd = pageEnd.trim();
      }

      setStage("reading");
      const res = await fetch("/api/lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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
                onChange={(e) => selectCollection(e.target.value)}
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

          {/* Lesson writer: cheap vs quality */}
          <div className="mt-3">
            <span className="text-sm text-muted">Write with</span>
            <div className="mt-1 inline-flex overflow-hidden rounded-lg border border-border">
              {LESSON_MODEL_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setLessonModel(o.value)}
                  disabled={busy}
                  className={cn(
                    "px-3 py-1 text-sm transition-colors disabled:opacity-50",
                    lessonModel === o.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted hover:bg-surface-2",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">
              <b>Quick</b> = Gemini Flash (cheapest). <b>Quick+</b> = Gemini Pro
              (stronger, still cheap). <b>Standard</b> = Claude (best teaching).
              <b> Deep</b> = Opus (richest). All output English.
            </p>
          </div>

          <div className="mt-3 flex items-center gap-2">
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
            <CostHint
              model={lessonModelLabel(lessonModel)}
              note={`reads pages with ${ocrModel === "claude" ? "Claude" : "Gemini"} OCR`}
              className="ml-auto"
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-accent">{error}</p>}

      {(stage === "uploading" ||
        stage === "reading" ||
        stage === "writing" ||
        article) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-border bg-surface p-5"
        >
          {stage === "uploading" && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <GeometricLoader size={20} />
              Uploading {pics.length > 1 ? `${pics.length} pages` : "the page"}…
            </p>
          )}
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
