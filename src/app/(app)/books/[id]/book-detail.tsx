"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  X,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import {
  masteryLevel,
  masteryInfo,
  MASTERY_ORDER,
  type MasteryLevel,
} from "@/lib/mastery";
import { collectionEmoji } from "@/lib/source";
import { cn } from "@/lib/utils";
import { generateSummary, setPageStatus, updateCollectionPages } from "../actions";

export type BookItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
  lesson_id: string | null;
  srs_reps: number | null;
  srs_lapses: number | null;
  srs_stability: number | null;
  srs_difficulty: number | null;
  srs_interval: number | null;
};

export type GridPage = {
  page_number: number;
  status: string;
  lesson_id: string | null;
  lesson_title: string | null;
  level: MasteryLevel | null;
  item_count: number;
};

type CollectionLite = {
  id: string;
  title: string;
  author: string | null;
  kind: string;
  total_pages: number | null;
  summary_md: string | null;
};

const PAGE_STATUSES: { value: "content" | "cover" | "index" | "skip"; label: string }[] =
  [
    { value: "content", label: "Content" },
    { value: "cover", label: "Cover" },
    { value: "index", label: "Index" },
    { value: "skip", label: "Skip" },
  ];

function cellClasses(page: GridPage | undefined): string {
  if (!page) return "bg-surface-2 text-muted border border-border";
  if (page.status === "cover")
    return "bg-surface text-muted border border-dashed border-border";
  if (page.status === "index")
    return "bg-surface-2 text-muted border border-border";
  if (page.status === "skip")
    return "bg-surface-2/60 text-muted/60 border border-border line-through";
  // content
  if (page.level == null)
    return "bg-primary/25 text-foreground border border-primary/30";
  return cn(masteryInfo(page.level).dot, "text-white border border-black/5");
}

export function BookDetail({
  collection,
  coverUrl,
  pages,
  itemsByLesson,
  items,
}: {
  collection: CollectionLite;
  coverUrl: string | null;
  pages: GridPage[];
  itemsByLesson: Record<string, BookItem[]>;
  items: BookItem[];
}) {
  const router = useRouter();

  const pageMap = useMemo(() => {
    const m = new Map<number, GridPage>();
    for (const p of pages) m.set(p.page_number, p);
    return m;
  }, [pages]);

  const uploadedCount = pages.filter((p) => p.status === "content").length;

  // Total-pages editor
  const [pagesInput, setPagesInput] = useState(
    collection.total_pages != null ? String(collection.total_pages) : "",
  );
  const [savingPages, setSavingPages] = useState(false);

  // Summary
  const [summary, setSummary] = useState<string | null>(collection.summary_md);
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Selected page panel
  const [selected, setSelected] = useState<number | null>(null);

  // Which page slots to render: 1..total_pages, or just the tracked pages.
  const slots = useMemo(() => {
    if (collection.total_pages && collection.total_pages > 0) {
      return Array.from({ length: collection.total_pages }, (_, i) => i + 1);
    }
    return pages.map((p) => p.page_number);
  }, [collection.total_pages, pages]);

  async function saveTotalPages() {
    setSavingPages(true);
    const n = parseInt(pagesInput, 10);
    await updateCollectionPages(collection.id, Number.isFinite(n) ? n : null);
    setSavingPages(false);
    router.refresh();
  }

  async function runSummary(force: boolean) {
    setSummaryBusy(true);
    setSummaryError(null);
    const res = await generateSummary(collection.id, force);
    setSummaryBusy(false);
    if ("error" in res) setSummaryError(res.error);
    else setSummary(res.summary_md);
  }

  async function markPage(
    pageNumber: number,
    status: "content" | "cover" | "index" | "skip",
  ) {
    await setPageStatus(collection.id, pageNumber, status);
    router.refresh();
  }

  const selectedPage = selected != null ? pageMap.get(selected) : undefined;
  const selectedItems =
    selectedPage?.lesson_id != null
      ? (itemsByLesson[selectedPage.lesson_id] ?? [])
      : [];

  const grouped = useMemo(() => {
    const g: Record<string, BookItem[]> = {
      vocab: [],
      grammar: [],
      expression: [],
    };
    for (const it of items) (g[it.type] ??= []).push(it);
    return g;
  }, [items]);

  return (
    <div className="space-y-6 py-4">
      <div>
        <Link
          href="/books"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All books
        </Link>
        <div className="flex gap-4">
          <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-2 text-3xl">
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverUrl}
                alt={collection.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{collectionEmoji(collection.kind)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-jp text-2xl font-bold">{collection.title}</h1>
            {collection.author && (
              <p className="mt-0.5 text-sm text-muted">{collection.author}</p>
            )}
            <p className="mt-2 text-sm text-muted">
              {collectionEmoji(collection.kind)} {uploadedCount}
              {collection.total_pages ? `/${collection.total_pages}` : ""} pages
              uploaded · {items.length} saved items
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted">Total pages</span>
              <input
                value={pagesInput}
                onChange={(e) => setPagesInput(e.target.value)}
                inputMode="numeric"
                placeholder="—"
                className="w-20 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={saveTotalPages}
                disabled={savingPages}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
              >
                {savingPages ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI summary */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Summary</h2>
          {summary && (
            <button
              onClick={() => runSummary(true)}
              disabled={summaryBusy}
              title="Regenerate"
              className="ml-auto flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", summaryBusy && "animate-spin")} />
              Refresh
            </button>
          )}
        </div>
        {summary ? (
          <div className="mt-2 text-sm">
            <Markdown>{summary}</Markdown>
          </div>
        ) : (
          <div className="mt-2">
            <button
              onClick={() => runSummary(false)}
              disabled={summaryBusy}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {summaryBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {summaryBusy ? "Writing…" : "Generate summary"}
            </button>
          </div>
        )}
        {summaryError && (
          <p className="mt-2 text-sm text-accent">{summaryError}</p>
        )}
      </section>

      {/* Page grid */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Pages</h2>
        {slots.length === 0 ? (
          <p className="text-sm text-muted">
            No pages tracked yet. Set a total page count above, or upload pages
            with a page number on the Lessons screen.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {slots.map((n) => {
                const page = pageMap.get(n);
                return (
                  <button
                    key={n}
                    onClick={() => setSelected(selected === n ? null : n)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-transform hover:scale-105",
                      cellClasses(page),
                      selected === n && "ring-2 ring-ring ring-offset-1 ring-offset-background",
                    )}
                    title={
                      page
                        ? `Page ${n} · ${page.status}${page.level ? ` · ${masteryInfo(page.level).label}` : ""}`
                        : `Page ${n} · not uploaded`
                    }
                  >
                    {n}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted">
              {MASTERY_ORDER.map((lvl) => (
                <span key={lvl} className="flex items-center gap-1">
                  <span className={cn("h-2.5 w-2.5 rounded", masteryInfo(lvl).dot)} />
                  {masteryInfo(lvl).label}
                </span>
              ))}
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-primary/25" /> Uploaded
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-surface-2 border border-border" />{" "}
                Empty
              </span>
            </div>
          </>
        )}

        {/* Selected page panel */}
        {selected != null && (
          <div className="mt-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Page {selected}</span>
              {selectedPage?.lesson_id && (
                <Link
                  href={`/lessons/${selectedPage.lesson_id}`}
                  className="text-xs text-primary hover:underline"
                >
                  {selectedPage.lesson_title ?? "Open lesson"}
                </Link>
              )}
              <button
                onClick={() => setSelected(null)}
                className="ml-auto rounded-full p-1 text-muted transition-colors hover:bg-surface-2"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Status flags */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PAGE_STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => markPage(selected, s.value)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                    (selectedPage?.status ?? "content") === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-surface text-muted hover:bg-surface-2",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {selectedItems.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {selectedItems.map((it) => {
                  const m = masteryLevel(it);
                  return (
                    <li key={it.id} className="flex items-center gap-2 text-sm">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", m.dot)} />
                      <span className="font-jp font-medium">{it.term}</span>
                      {it.meaning && (
                        <span className="truncate text-muted">— {it.meaning}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">
                {selectedPage?.lesson_id
                  ? "No saved items from this page yet."
                  : "This page hasn't been turned into a lesson yet."}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Knowledge from this collection */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">
          Vocabulary &amp; grammar ({items.length})
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted">Nothing saved from this yet.</p>
        ) : (
          <div className="space-y-4">
            {(["vocab", "grammar", "expression"] as const).map((t) =>
              grouped[t]?.length ? (
                <div key={t}>
                  <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                    {t}
                  </h3>
                  <div className="space-y-1.5">
                    {grouped[t].map((it) => {
                      const m = masteryLevel(it);
                      return (
                        <Link
                          key={it.id}
                          href={`/review?item=${it.id}`}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl border bg-surface px-3 py-2 transition-colors hover:bg-surface-2",
                            m.ring,
                          )}
                        >
                          <span
                            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", m.dot)}
                            title={m.label}
                          />
                          <span className="font-jp text-base font-medium">
                            {it.term}
                          </span>
                          {it.meaning && (
                            <span className="truncate text-sm text-muted">
                              {it.meaning}
                            </span>
                          )}
                          {it.jlpt_level && (
                            <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                              {it.jlpt_level}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        )}
      </section>
    </div>
  );
}
