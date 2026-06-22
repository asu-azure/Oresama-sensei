"use client";

import { useEffect, useRef, useState } from "react";
import {
  ImagePlus,
  Upload,
  Pencil,
  Search,
  Trash2,
  Loader2,
} from "lucide-react";
import { ImagePreview } from "@/components/image-preview";
import { stripFurigana } from "@/lib/furigana";
import { DrawCanvas } from "./draw-canvas";
import { WebImageSearch } from "./web-image-search";
import {
  uploadItemImage,
  setItemImageFromUrl,
  removeItemImage,
  getItemImageUrls,
} from "@/lib/item-image-actions";
import { cn } from "@/lib/utils";

type Urls = { thumb: string; full: string };

/** The per-knowledge-item image control: shows the picture (with a lightbox) and
 *  lets you add/change it via Upload / Draw / Find online / Remove. Used on the
 *  flashcard reveal and in the library/search rows. Pass `initial` (already-signed
 *  urls, e.g. from the review page) OR `lazyPath` (the image_path, signed on mount
 *  — for the library, which renders this only when a row is expanded). */
export function ItemImage({
  itemId,
  term,
  meaning = null,
  reading = null,
  initial = null,
  initialSource = null,
  lazyPath = null,
  className,
}: {
  itemId: string;
  term: string;
  meaning?: string | null;
  reading?: string | null;
  initial?: Urls | null;
  initialSource?: string | null;
  lazyPath?: string | null;
  className?: string;
}) {
  const [img, setImg] = useState<Urls | null>(initial);
  const [source, setSource] = useState<string | null>(initialSource);
  const [menu, setMenu] = useState(false);
  const [draw, setDraw] = useState(false);
  const [search, setSearch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Library: sign the stored path lazily on mount (component only mounts when the
  // row is expanded). setState lives in the async .then, so it's lint-clean.
  useEffect(() => {
    if (initial || !lazyPath) return;
    let alive = true;
    getItemImageUrls(lazyPath).then((u) => {
      if (alive && u) setImg(u);
    });
    return () => {
      alive = false;
    };
  }, [initial, lazyPath]);

  async function doUpload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadItemImage(itemId, fd);
      if ("error" in res) setError(res.error);
      else {
        setImg({ thumb: res.thumb, full: res.full });
        setSource(res.source);
        setMenu(false);
        setDraw(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function pickWeb(url: string, credit: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await setItemImageFromUrl(itemId, url, credit);
      if ("error" in res) setError(res.error);
      else {
        setImg({ thumb: res.thumb, full: res.full });
        setSource(res.source);
        setMenu(false);
        setSearch(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await removeItemImage(itemId);
      setImg(null);
      setSource(null);
      setMenu(false);
    } finally {
      setBusy(false);
    }
  }

  // Keyword suggestions for "Find online" (free — no AI). The English meaning
  // tends to give the best image matches, so it's the default query.
  const primaryMeaning = (meaning ?? "").split(/[;,/]/)[0].trim();
  const imageSuggestions = Array.from(
    new Set(
      [primaryMeaning, term, stripFurigana(reading ?? "").trim()].filter(Boolean),
    ),
  );
  const imageInitialQuery = primaryMeaning || term;

  return (
    <div className={cn("mt-3", className)}>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void doUpload(f);
        }}
      />

      {img ? (
        <div className="flex flex-col items-center gap-1.5">
          <ImagePreview urls={[img]} directLightbox>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.thumb}
              alt={term}
              decoding="async"
              className="max-h-40 cursor-zoom-in rounded-xl border border-border object-contain"
            />
          </ImagePreview>
          {source && (
            <p className="max-w-full truncate text-[10px] text-muted" title={source}>
              {source}
            </p>
          )}
          <button
            onClick={() => setMenu((m) => !m)}
            className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Change image
          </button>
        </div>
      ) : (
        <button
          onClick={() => setMenu((m) => !m)}
          className="mx-auto flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          Add image
        </button>
      )}

      {menu && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          <MenuBtn onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </MenuBtn>
          <MenuBtn onClick={() => setDraw(true)} disabled={busy}>
            <Pencil className="h-3.5 w-3.5" /> Draw
          </MenuBtn>
          <MenuBtn onClick={() => setSearch(true)} disabled={busy}>
            <Search className="h-3.5 w-3.5" /> Find online
          </MenuBtn>
          {img && (
            <MenuBtn onClick={remove} disabled={busy} danger>
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </MenuBtn>
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-center text-xs text-accent">{error}</p>}

      {draw && (
        <DrawCanvas
          busy={busy}
          onSave={doUpload}
          onClose={() => setDraw(false)}
        />
      )}
      {search && (
        <WebImageSearch
          suggestions={imageSuggestions}
          initialQuery={imageInitialQuery}
          busy={busy}
          onPick={pickWeb}
          onClose={() => setSearch(false)}
        />
      )}
    </div>
  );
}

function MenuBtn({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs transition-colors disabled:opacity-50",
        danger
          ? "text-accent hover:bg-accent/10"
          : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
