"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ImagePlus, X, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { createCollection } from "./actions";

const KINDS: { value: string; label: string; emoji: string }[] = [
  { value: "book", label: "Book", emoji: "📖" },
  { value: "series", label: "Series", emoji: "📚" },
  { value: "game", label: "Game", emoji: "🎮" },
  { value: "other", label: "Other", emoji: "•" },
];

export function AddBook() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("book");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [cover, setCover] = useState<{ file: File; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  function reset() {
    if (cover) URL.revokeObjectURL(cover.url);
    setKind("book");
    setTitle("");
    setAuthor("");
    setTotalPages("");
    setCover(null);
    setError(null);
  }

  function pickCover(list: FileList | null) {
    const f = list?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    if (cover) URL.revokeObjectURL(cover.url);
    setCover({ file: f, url: URL.createObjectURL(f) });
  }

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.append("title", title.trim());
    fd.append("kind", kind);
    if (author.trim()) fd.append("author", author.trim());
    if (totalPages.trim()) fd.append("totalPages", totalPages.trim());
    if (cover) fd.append("cover", cover.file);
    const res = await createCollection(fd);
    setBusy(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    reset();
    setOpen(false);
    router.push(`/books/${res.id}`);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Add book
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center">
        <h2 className="text-sm font-semibold">New collection</h2>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="ml-auto rounded-full p-1 text-muted transition-colors hover:bg-surface-2"
          aria-label="Cancel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.value}
            onClick={() => setKind(k.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              kind === k.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <span className="mr-1">{k.emoji}</span>
            {k.label}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (e.g. 新完全マスター N2 読解)"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        placeholder="Author / studio (optional)"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Total pages</span>
          <input
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            inputMode="numeric"
            placeholder="opt."
            className="w-20 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickCover(e.target.files)}
        />
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
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow"
              aria-label="Remove cover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => coverRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2"
          >
            <ImagePlus className="h-4 w-4" /> Add cover
          </button>
        )}
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !title.trim()}
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Check className="h-4 w-4" />
        )}
        Create
      </button>
    </div>
  );
}
