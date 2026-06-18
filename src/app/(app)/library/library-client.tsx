"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Search,
  Library as LibraryIcon,
  ChevronDown,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  masteryLevel,
  masteryInfo,
  MASTERY_ORDER,
  type MasteryLevel,
} from "@/lib/mastery";
import { showReading } from "@/lib/furigana";
import { sourceMeta } from "@/lib/source";
import { SpeakButton } from "@/components/speak-button";
import { KanjiChips } from "@/components/kanji/kanji-chips";
import { DeepDiveSection } from "@/components/knowledge/deep-dive-section";
import { PitchAccent } from "@/components/pitch-accent";
import { PitchToggle } from "@/components/pitch-toggle";
import { PitchLegend } from "@/components/pitch-legend";
import { usePitch } from "@/lib/use-pitch";
import type { ExplanationMap } from "./explanations";
import { cn, formatDate } from "@/lib/utils";
import { LibraryCalendar } from "./library-calendar";
import { loadItemsForDay, loadMoreItems } from "./actions";

export type LibraryItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  srs_reps: number | null;
  srs_interval: number | null;
  srs_lapses: number | null;
  srs_stability: number | null;
  srs_difficulty: number | null;
  srs_due: string | null;
  times_seen: number | null;
  last_seen: string;
  created_at: string;
  source_type: string | null;
  collection_id: string | null;
  collections: { title: string; kind: string } | null;
};

const TYPES = ["all", "vocab", "grammar", "expression"];

export function LibraryClient({
  initialItems,
  dayCounts,
  total,
  pageSize,
  explanations,
  explainedIds,
}: {
  initialItems: LibraryItem[];
  dayCounts: Record<string, number>;
  total: number;
  pageSize: number;
  explanations: ExplanationMap;
  explainedIds: string[];
}) {
  const reduce = useReducedMotion();
  const pitchOn = usePitch();
  const explainedSet = useMemo(() => new Set(explainedIds), [explainedIds]);

  // Filters
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [jlpt, setJlpt] = useState("all");
  const [mastery, setMastery] = useState<MasteryLevel | "all">("all");
  const [source, setSource] = useState("all");

  // Recent list + infinite scroll
  const [items, setItems] = useState<LibraryItem[]>(initialItems);
  const [hasMore, setHasMore] = useState(initialItems.length < total);
  const [loadingMore, setLoadingMore] = useState(false);
  const offsetRef = useRef(initialItems.length);
  const loadingRef = useRef(false);

  // Calendar date filtering
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayItems, setDayItems] = useState<LibraryItem[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);

  // Expand/collapse
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoadingMore(true);
    const res = await loadMoreItems(offsetRef.current, pageSize);
    setItems((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      return [...prev, ...res.items.filter((i) => !seen.has(i.id))];
    });
    offsetRef.current += res.items.length;
    setHasMore(res.hasMore);
    setLoadingMore(false);
    loadingRef.current = false;
  }, [hasMore, pageSize]);

  const selectDate = useCallback(async (day: string | null) => {
    setSelectedDate(day);
    setExpanded(new Set());
    if (day === null) {
      setDayItems([]);
      return;
    }
    setLoadingDay(true);
    const its = await loadItemsForDay(day);
    setDayItems(its);
    setLoadingDay(false);
  }, []);

  // Auto-load more when the sentinel scrolls into view (recent list only).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedDate || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [selectedDate, hasMore, loadMore]);

  const base = selectedDate ? dayItems : items;

  const jlptLevels = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.jlpt_level) s.add(it.jlpt_level);
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const sourceTypes = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.source_type) s.add(it.source_type);
    return ["all", ...Array.from(s).sort()];
  }, [items]);

  const withMastery = useMemo(
    () => base.map((it) => ({ it, m: masteryLevel(it) })),
    [base],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const { m } of withMastery) c[m.level] = (c[m.level] ?? 0) + 1;
    return c;
  }, [withMastery]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withMastery.filter(({ it, m }) => {
      if (type !== "all" && it.type !== type) return false;
      if (jlpt !== "all" && it.jlpt_level !== jlpt) return false;
      if (mastery !== "all" && m.level !== mastery) return false;
      if (source !== "all" && it.source_type !== source) return false;
      if (needle) {
        const hay = `${it.term} ${it.reading ?? ""} ${
          it.meaning ?? ""
        }`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [withMastery, q, type, jlpt, mastery, source]);

  if (total === 0) {
    return (
      <div className="py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LibraryIcon className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Your vocab library is empty</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Chat with the tutor or make a lesson from a photo. Everything you learn
          is saved here and color-coded by how well you have practiced it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Vocab &amp; grammar</h1>
          <p className="mt-1 text-sm text-muted">
            {total} saved {total === 1 ? "item" : "items"} · tap a day to see what
            you added, tap any item to expand it.
          </p>
        </div>
        <PitchToggle />
      </div>

      <PitchLegend />

      <LibraryCalendar
        dayCounts={dayCounts}
        selectedDate={selectedDate}
        onSelect={selectDate}
      />

      {selectedDate && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{formatDate(selectedDate)}</span>
          <span className="text-muted">
            · {loadingDay ? "loading…" : `${dayItems.length} added`}
          </span>
          <button
            onClick={() => selectDate(null)}
            className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            <X className="h-3 w-3" />
            clear
          </button>
        </div>
      )}

      {/* Mastery legend doubles as a filter */}
      <div className="flex flex-wrap gap-2">
        {MASTERY_ORDER.map((lvl) => {
          const info = masteryInfo(lvl);
          const active = mastery === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setMastery(active ? "all" : lvl)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? info.chip
                  : "border-border bg-surface text-muted hover:bg-surface-2",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", info.dot)} />
              {info.label}
              <span className="opacity-60">{counts[lvl] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <details className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
        <summary className="cursor-pointer select-none font-medium">
          How are these levels decided?
        </summary>
        <p className="mt-2">
          Levels come from <span className="font-medium">FSRS</span>, which
          models your memory and estimates each item&apos;s{" "}
          <span className="font-medium">stability</span> — roughly how long
          you&apos;d still remember it. It grows as you recall correctly and
          shrinks when you slip.
        </p>
        <ul className="mt-2 space-y-1">
          <li>
            <span className="font-medium text-foreground">New</span> — saved but
            never reviewed yet.
          </li>
          <li>
            <span className="font-medium text-foreground">Learning</span> —
            stability under ~1 week.
          </li>
          <li>
            <span className="font-medium text-foreground">Young</span> — getting
            solid: stability ~1–3 weeks.
          </li>
          <li>
            <span className="font-medium text-foreground">Mastered</span> —
            stability past ~3 weeks.
          </li>
          <li>
            <span className="font-medium text-foreground">Struggling</span> —
            you&apos;ve missed it a couple of times (or FSRS rates it hard), so
            it&apos;s flagged for extra practice regardless of stability.
          </li>
        </ul>
        <p className="mt-2">
          Practicing in Review/Tests updates this automatically. Tap a level
          above to filter.
        </p>
      </details>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search term, reading, or meaning…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
              {t}
            </FilterChip>
          ))}
          <span className="mx-1 w-px self-stretch bg-border" />
          {jlptLevels.map((l) => (
            <FilterChip key={l} active={jlpt === l} onClick={() => setJlpt(l)}>
              {l === "all" ? "all JLPT" : l}
            </FilterChip>
          ))}
        </div>
        {sourceTypes.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {sourceTypes.map((s) => (
              <FilterChip
                key={s}
                active={source === s}
                onClick={() => setSource(s)}
              >
                {s === "all"
                  ? "all sources"
                  : `${sourceMeta(s).emoji} ${sourceMeta(s).label}`}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        {selectedDate
          ? `${filtered.length} on this day`
          : `${filtered.length} shown · ${total} total`}
      </p>

      <div className="space-y-2">
        {filtered.map(({ it, m }) => {
          const open = expanded.has(it.id);
          return (
            <div
              key={it.id}
              className={cn(
                "overflow-hidden rounded-xl border bg-surface",
                m.ring,
              )}
            >
              <button
                onClick={() => toggle(it.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                aria-expanded={open}
              >
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", m.dot)}
                  title={m.label}
                />
                <span className="min-w-0 flex-1 truncate font-jp text-base font-medium">
                  {it.term}
                </span>
                {explainedSet.has(it.id) && (
                  <Sparkles
                    className="h-3.5 w-3.5 shrink-0 text-primary"
                    aria-label="Has a saved explanation"
                  />
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted transition-transform",
                    open && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    initial={reduce ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduce ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-border px-3 pb-3 pt-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {showReading(it.term, it.reading) &&
                            (pitchOn ? (
                              <PitchAccent
                                term={it.term}
                                reading={it.reading!}
                                className="text-sm text-muted"
                              />
                            ) : (
                              <p className="font-jp text-sm text-muted">
                                {it.reading}
                              </p>
                            ))}
                          {it.meaning && (
                            <p className="mt-1 text-sm">{it.meaning}</p>
                          )}
                          {it.example && (
                            <p className="mt-1 font-jp text-xs text-muted">
                              {it.example}
                            </p>
                          )}
                        </div>
                        <SpeakButton text={it.reading || it.term} />
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                          {it.type}
                        </span>
                        {it.jlpt_level && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            {it.jlpt_level}
                          </span>
                        )}
                        {it.source_type && (
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                            {sourceMeta(it.source_type).emoji}{" "}
                            {it.collections?.title ??
                              sourceMeta(it.source_type).label}
                          </span>
                        )}
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full border px-2 py-0.5",
                            m.chip,
                          )}
                        >
                          <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
                          {m.label}
                        </span>
                        {(it.times_seen ?? 0) > 1 && (
                          <span className="text-muted">
                            seen {it.times_seen}x
                          </span>
                        )}
                        <Link
                          href={`/review?item=${it.id}`}
                          className="ml-auto rounded-full border border-border px-2 py-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          Review
                        </Link>
                      </div>
                      <KanjiChips term={it.term} />
                      <DeepDiveSection
                        itemId={it.id}
                        initialExplanation={
                          explanations[it.id]?.explanation_md ?? null
                        }
                        initialExamples={explanations[it.id]?.examples ?? []}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !loadingDay && (
        <p className="py-10 text-center text-sm text-muted">
          No items match these filters.
        </p>
      )}

      {/* Infinite-scroll sentinel (recent list only) */}
      {!selectedDate && hasMore && (
        <div
          ref={sentinelRef}
          className="flex justify-center py-4 text-sm text-muted"
        >
          {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
        </div>
      )}

      {pitchOn && (
        <p className="pt-2 text-center text-[11px] text-muted">
          Pitch-accent data:{" "}
          <a
            href="https://github.com/mifunetoshiro/kanjium"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            kanjium
          </a>{" "}
          (CC BY-SA 4.0).
        </p>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-surface text-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  );
}
