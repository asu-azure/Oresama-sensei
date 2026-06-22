"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Hit = {
  id: string;
  title: string;
  thumb: string;
  url: string;
  creator: string;
  license: string;
  landing: string;
  attribution: string;
};

/** Search free CC-licensed images (Openverse, via our proxy) and pick one. The
 *  pick is downloaded into private storage by the caller (setItemImageFromUrl).
 *  `suggestions` are tappable pre-filled keywords (meaning / term / reading); the
 *  box stays editable for a custom keyword. No AI tokens are used. */
export function WebImageSearch({
  suggestions,
  initialQuery,
  onPick,
  onClose,
  busy = false,
}: {
  suggestions: string[];
  initialQuery: string;
  onPick: (url: string, credit: string) => Promise<void> | void;
  onClose: () => void;
  busy?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(initialQuery);
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);

  async function run(q: string) {
    const term = q.trim();
    if (!term) return;
    setActive(term);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/items/image-search?q=${encodeURIComponent(term)}`,
      );
      const data = (await res.json()) as { results?: Hit[] };
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function runSuggestion(s: string) {
    setQuery(s);
    void run(s);
  }

  // Auto-search the default keyword on open. Deferred via setTimeout so the
  // setState inside run() isn't called synchronously within the effect.
  useEffect(() => {
    if (!initialQuery.trim()) return;
    const id = setTimeout(() => void run(initialQuery), 0);
    return () => clearTimeout(id);
  }, [initialQuery]);

  async function pick(h: Hit) {
    setPicking(h.id);
    const credit =
      h.attribution ||
      [h.creator && `© ${h.creator}`, h.license, h.landing]
        .filter(Boolean)
        .join(" · ");
    await onPick(h.url, credit);
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-border bg-background p-4 shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm font-medium">Find an image</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-surface-2"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(query);
          }}
          className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="text-muted transition-colors hover:text-foreground disabled:opacity-40"
            aria-label="Search"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </button>
        </form>

        {suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => runSuggestion(s)}
                disabled={loading}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-50",
                  active === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted">
              No images yet — try a different search.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {results.map((h) => (
                <button
                  key={h.id}
                  onClick={() => pick(h)}
                  disabled={busy || picking !== null}
                  title={`${h.title}${h.license ? ` · ${h.license}` : ""}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-2 transition-transform hover:scale-[1.03] disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={h.thumb}
                    alt={h.title || "image result"}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                  {picking === h.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] leading-tight text-muted">
          Images from Openverse (CC-licensed). The one you pick is saved with its
          credit.
        </p>
      </div>
    </div>,
    document.body,
  );
}
