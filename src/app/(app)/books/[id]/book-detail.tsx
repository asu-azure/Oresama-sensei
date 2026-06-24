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
  ChevronDown,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { ImagePreview } from "@/components/image-preview";
import {
  masteryLevel,
  masteryInfo,
  MASTERY_ORDER,
  type MasteryLevel,
} from "@/lib/mastery";
import { collectionEmoji, materialForCollectionKind } from "@/lib/source";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { cn } from "@/lib/utils";
import { getBookPageImages } from "../../library/actions";
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
  image_path: string | null;
  chapter: string | null;
  chapter_page: number | null;
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
  // When on, tapping a page opens its status/edit panel instead of navigating.
  const [editMode, setEditMode] = useState(false);

  // Navigate to a page's lesson, or start a new lesson for a blank page.
  function goToPage(n: number) {
    const page = pageMap.get(n);
    if (page?.lesson_id) {
      router.push(`/lessons/${page.lesson_id}`);
    } else {
      const material = materialForCollectionKind(collection.kind);
      router.push(
        `/lessons?collection=${collection.id}&page=${n}&material=${material}`,
      );
    }
  }

  // Tapping a page: in edit mode, toggle its status panel. In view mode, the
  // first tap opens a preview (saved items on that page); a second tap on the
  // same page opens its lesson.
  function onCellClick(n: number) {
    if (editMode) {
      setSelected(selected === n ? null : n);
      return;
    }
    if (selected === n) {
      goToPage(n);
    } else {
      setSelected(n);
    }
  }

  // Which page slots to render: 1..total_pages, or just the tracked pages.
  const slots = useMemo(() => {
    if (collection.total_pages && collection.total_pages > 0) {
      return Array.from({ length: collection.total_pages }, (_, i) => i + 1);
    }
    return pages.map((p) => p.page_number);
  }, [collection.total_pages, pages]);

  // Group pages into ranges of 50 so a long book isn't an intimidating wall of
  // cells. Each range collapses to a summary bar; one expands at a time.
  const RANGE_SIZE = 50;
  const ranges = useMemo(() => {
    const out: { idx: number; start: number; end: number; nums: number[] }[] = [];
    for (let i = 0; i < slots.length; i += RANGE_SIZE) {
      const nums = slots.slice(i, i + RANGE_SIZE);
      out.push({
        idx: out.length,
        start: nums[0],
        end: nums[nums.length - 1],
        nums,
      });
    }
    return out;
  }, [slots]);

  const [openRange, setOpenRange] = useState(0);
  const [jumpInput, setJumpInput] = useState("");

  function rangeStats(nums: number[]) {
    const byLevel: Partial<Record<MasteryLevel, number>> = {};
    let studied = 0;
    for (const n of nums) {
      const p = pageMap.get(n);
      if (p && p.status === "content" && p.level) {
        byLevel[p.level] = (byLevel[p.level] ?? 0) + 1;
        studied++;
      }
    }
    return { studied, byLevel };
  }

  function jumpToPage() {
    const n = parseInt(jumpInput, 10);
    if (!Number.isFinite(n)) return;
    const ri = ranges.findIndex((r) => r.nums.includes(n));
    if (ri === -1) return;
    setOpenRange(ri);
    setSelected(n);
    setJumpInput("");
    setTimeout(
      () =>
        document
          .getElementById(`book-page-${n}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      60,
    );
  }

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

  // Chapter grouping: ordered list of chapters (by their first page), each with
  // the content pages it spans. Only built when some lesson carries a chapter.
  const chapters = useMemo(() => {
    const map = new Map<string, number[]>();
    let any = false;
    for (const p of pages) {
      if (p.status !== "content") continue;
      const key = p.chapter?.trim();
      if (!key) continue;
      any = true;
      (map.get(key) ?? map.set(key, []).get(key)!).push(p.page_number);
    }
    if (!any) return null;
    const out = [...map.entries()].map(([name, nums]) => ({
      name,
      nums: nums.sort((a, b) => a - b),
    }));
    out.sort((a, b) => a.nums[0] - b.nums[0]);
    return out;
  }, [pages]);

  const [openChapter, setOpenChapter] = useState(0);

  // One page cell (shared by the range grid and the chapter sections).
  function renderCell(n: number) {
    const page = pageMap.get(n);
    const cell = (
      <button
        id={`book-page-${n}`}
        onClick={() => onCellClick(n)}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-transform hover:scale-105",
          cellClasses(page),
          selected === n &&
            "ring-2 ring-ring ring-offset-1 ring-offset-background",
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
    return page?.lesson_id || page?.image_path ? (
      <ImagePreview
        key={n}
        load={() => getBookPageImages(page.lesson_id, page.image_path)}
        hoverOnly
      >
        {cell}
      </ImagePreview>
    ) : (
      <span key={n} className="inline-flex">
        {cell}
      </span>
    );
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
            <div className="ml-auto flex items-center gap-2">
              <CostHint model={MODEL_LABELS.engine} />
              <button
                onClick={() => runSummary(true)}
                disabled={summaryBusy}
                title="Regenerate"
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3 w-3", summaryBusy && "animate-spin")} />
                Refresh
              </button>
            </div>
          )}
        </div>
        {summary ? (
          <div className="mt-2 text-sm">
            <Markdown>{summary}</Markdown>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3">
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
            <CostHint model={MODEL_LABELS.engine} />
          </div>
        )}
        {summaryError && (
          <p className="mt-2 text-sm text-accent">{summaryError}</p>
        )}
      </section>

      {/* Page grid */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold">Pages</h2>
          <p className="text-xs text-muted">
            {editMode ? "Tap a page to flag it" : "Tap to preview · tap again to open"}
          </p>
          <button
            onClick={() => {
              setEditMode((e) => !e);
              setSelected(null);
            }}
            className={cn(
              "ml-auto rounded-full border px-2.5 py-1 text-xs transition-colors",
              editMode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {editMode ? "Done" : "Edit pages"}
          </button>
        </div>
        {slots.length === 0 ? (
          <p className="text-sm text-muted">
            No pages tracked yet. Set a total page count above, or upload pages
            with a page number on the Lessons screen.
          </p>
        ) : (
          <>
            {/* Jump to a page */}
            {slots.length > RANGE_SIZE && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") jumpToPage();
                  }}
                  inputMode="numeric"
                  placeholder="Jump to page…"
                  className="w-32 rounded-lg border border-border bg-surface px-2.5 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  onClick={jumpToPage}
                  className="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  Go
                </button>
              </div>
            )}

            {/* Chapters (when lessons carry a chapter): collapsible sections for
                thematic navigation, above the full page index below. */}
            {chapters && (
              <div className="mb-3 space-y-1.5">
                <p className="text-xs font-medium text-muted">Chapters</p>
                {chapters.map((c, ci) => {
                  const open = openChapter === ci;
                  return (
                    <div
                      key={c.name}
                      className="overflow-hidden rounded-xl border border-border bg-surface"
                    >
                      <button
                        onClick={() => setOpenChapter(open ? -1 : ci)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                        aria-expanded={open}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium font-jp">
                          {c.name}
                        </span>
                        <span className="shrink-0 text-xs text-muted">
                          {c.nums.length} page{c.nums.length === 1 ? "" : "s"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </button>
                      {open && (
                        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-3">
                          {c.nums.map((n) => renderCell(n))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Collapsible ranges of 50 (full page index) */}
            <div className="space-y-1.5">
              {ranges.map((r) => {
                const { studied, byLevel } = rangeStats(r.nums);
                const open = openRange === r.idx;
                return (
                  <div
                    key={r.idx}
                    className="overflow-hidden rounded-xl border border-border bg-surface"
                  >
                    <button
                      onClick={() => setOpenRange(open ? -1 : r.idx)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                      aria-expanded={open}
                    >
                      <span className="w-28 shrink-0 text-sm font-medium">
                        Pages {r.start}–{r.end}
                      </span>
                      {/* Mini mastery bar */}
                      <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        {MASTERY_ORDER.map((lvl) => {
                          const c = byLevel[lvl] ?? 0;
                          if (c === 0) return null;
                          return (
                            <span
                              key={lvl}
                              className={cn("h-full", masteryInfo(lvl).dot)}
                              style={{ width: `${(c / r.nums.length) * 100}%` }}
                            />
                          );
                        })}
                      </span>
                      <span className="w-20 shrink-0 text-right text-xs text-muted">
                        {studied} studied
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted transition-transform",
                          open && "rotate-180",
                        )}
                      />
                    </button>
                    {open && (
                      <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-3">
                        {r.nums.map((n) => renderCell(n))}
                      </div>
                    )}
                  </div>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Page {selected}</span>
              {selectedPage?.chapter && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  {selectedPage.chapter}
                  {selectedPage.chapter_page != null
                    ? ` · p.${selectedPage.chapter_page}`
                    : ""}
                </span>
              )}
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

            {/* Status flags (edit mode only) */}
            {editMode && (
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
            )}

            {/* View-mode: clear affordance to open the lesson (also: second tap
                on the page does this). */}
            {!editMode && (
              <button
                onClick={() => goToPage(selected)}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {selectedPage?.lesson_id ? "Open lesson →" : "Create lesson →"}
              </button>
            )}

            {(selectedPage?.lesson_id || selectedPage?.image_path) && (
              <ImagePreview
                load={() =>
                  getBookPageImages(
                    selectedPage.lesson_id,
                    selectedPage.image_path,
                  )
                }
                directLightbox
              >
                <span className="mt-2 flex cursor-zoom-in items-center gap-1 text-xs text-primary hover:underline">
                  <ImageIcon className="h-3.5 w-3.5" /> View page photo
                </span>
              </ImagePreview>
            )}

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
