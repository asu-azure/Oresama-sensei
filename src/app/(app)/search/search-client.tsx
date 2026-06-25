"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageHeading } from "@/components/motion/page-heading";
import Fuse from "fuse.js";
import { toHiragana, toRomaji } from "wanakana";
import {
  Search as SearchIcon,
  ChevronDown,
  BookOpen,
  Loader2,
  MessageCircle,
  Sparkles,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { showReading, stripFurigana } from "@/lib/furigana";
import { RubyText } from "@/components/ruby-text";
import { SpeakButton } from "@/components/speak-button";
import { KanjiChips } from "@/components/kanji/kanji-chips";
import { ImagePreview } from "@/components/image-preview";
import { DeepDiveSection } from "@/components/knowledge/deep-dive-section";
import { ItemImage } from "@/components/knowledge/item-image";
import { PitchAccent } from "@/components/pitch-accent";
import { PitchToggle } from "@/components/pitch-toggle";
import { PitchLegend } from "@/components/pitch-legend";
import { usePitch } from "@/lib/use-pitch";
import type { ExplanationMap } from "../library/explanations";
import { getLessonImageUrls } from "../library/actions";
import { searchLessons, type LessonHit } from "./actions";

export type SearchItem = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  lesson_id: string | null;
  image_path: string | null;
};

export function SearchClient({
  items,
  explanations,
  explainedIds,
}: {
  items: SearchItem[];
  explanations: ExplanationMap;
  explainedIds: string[];
}) {
  const reduce = useReducedMotion();
  const pitchOn = usePitch();
  const explainedSet = useMemo(() => new Set(explainedIds), [explainedIds]);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lessons, setLessons] = useState<LessonHit[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Fuzzy index over term / reading / rōmaji(reading) / meaning.
  const fuse = useMemo(() => {
    const docs = items.map((it) => ({
      ...it,
      romaji: toRomaji(stripFurigana(it.reading || it.term || "")),
    }));
    return new Fuse(docs, {
      threshold: 0.34,
      ignoreLocation: true,
      keys: ["term", "reading", "romaji", "meaning"],
    });
  }, [items]);

  // Live item results: search the raw query AND its kana form (so "taberu",
  // "たべ", "食べる", "eat" all hit). Pure-derived = instant, no API cost.
  const results = useMemo(() => {
    const query = q.trim();
    if (!query) return [];
    const queries = new Set<string>([query]);
    const kana = toHiragana(query);
    if (kana && kana !== query) queries.add(kana);

    const seen = new Set<string>();
    const out: SearchItem[] = [];
    for (const term of queries) {
      for (const r of fuse.search(term, { limit: 50 })) {
        if (!seen.has(r.item.id)) {
          seen.add(r.item.id);
          out.push(r.item);
        }
      }
    }
    return out.slice(0, 60);
  }, [q, fuse]);

  // Debounced lesson search (server). Driven from the input handler (not an
  // effect) to avoid synchronous setState-in-effect.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = useCallback((value: string) => {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (!trimmed) {
      reqId.current++;
      setLessons([]);
      setLessonsLoading(false);
      return;
    }
    setLessonsLoading(true);
    const id = ++reqId.current;
    timer.current = setTimeout(() => {
      searchLessons(trimmed)
        .then((res) => {
          if (reqId.current === id) {
            setLessons(res);
            setLessonsLoading(false);
          }
        })
        .catch(() => {
          if (reqId.current === id) {
            setLessons([]);
            setLessonsLoading(false);
          }
        });
    }, 250);
  }, []);

  const hasQuery = q.trim().length > 0;

  return (
    <div className="space-y-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <PageHeading
          className="m-0"
          kicker="LOOK UP — INSTANTLY"
          title="Search"
          jp="検索"
          subtitle="Look up anything you've saved — by kanji, kana, rōmaji, or English meaning. Results appear as you type."
        />
        <PitchToggle />
      </div>

      <PitchLegend />

      <div className="sticky top-16 z-10 -mx-1 px-1">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g. 食べる, たべる, taberu, or “eat”…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {!hasQuery ? (
        <p className="py-12 text-center text-sm text-muted">
          {items.length} saved items to search. Start typing…
        </p>
      ) : (
        <>
          {/* Saved items */}
          <section className="space-y-2">
            <p className="text-xs text-muted">
              {results.length} {results.length === 1 ? "item" : "items"}
            </p>
            {results.map((it) => {
              const open = expanded.has(it.id);
              return (
                <div
                  key={it.id}
                  className="overflow-hidden rounded-xl border border-border bg-surface"
                >
                  <button
                    onClick={() => toggle(it.id)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                    aria-expanded={open}
                  >
                    <span className="min-w-0 flex-1 truncate font-jp text-base font-medium">
                      <RubyText>{it.term}</RubyText>
                    </span>
                    {explainedSet.has(it.id) && (
                      <Sparkles
                        className="h-3.5 w-3.5 shrink-0 text-primary"
                        aria-label="Has a saved explanation"
                      />
                    )}
                    {it.jlpt_level && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                        {it.jlpt_level}
                      </span>
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
                                  <RubyText>{it.example}</RubyText>
                                </p>
                              )}
                            </div>
                            <SpeakButton
                              text={stripFurigana(it.reading || it.term)}
                            />
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
                              {it.type}
                            </span>
                            {it.lesson_id && (
                              <>
                                <Link
                                  href={`/lessons/${it.lesson_id}`}
                                  className="ml-auto flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                                >
                                  <BookOpen className="h-3 w-3" /> Lesson
                                </Link>
                                <ImagePreview
                                  load={() => getLessonImageUrls(it.lesson_id!)}
                                >
                                  <span className="flex cursor-pointer items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground">
                                    <ImageIcon className="h-3 w-3" /> Page
                                  </span>
                                </ImagePreview>
                              </>
                            )}
                            <Link
                              href={`/review?item=${it.id}`}
                              className={cn(
                                "rounded-full border border-border px-2 py-0.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground",
                                !it.lesson_id && "ml-auto",
                              )}
                            >
                              Practice
                            </Link>
                          </div>
                          <KanjiChips term={it.term} />
                          <ItemImage
                            itemId={it.id}
                            term={stripFurigana(it.term)}
                            meaning={it.meaning}
                            reading={it.reading}
                            lazyPath={it.image_path}
                          />
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
            {results.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                No saved items match.
              </p>
            )}
          </section>

          {/* Lessons */}
          <section className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <BookOpen className="h-3.5 w-3.5" /> In your lessons
            </p>
            {lessonsLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> searching…
              </p>
            ) : lessons.length > 0 ? (
              <ul className="space-y-1">
                {lessons.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/lessons/${l.id}`}
                      className="block truncate rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors hover:bg-surface-2"
                    >
                      {l.title || "Untitled lesson"}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No lessons mention this.</p>
            )}
          </section>

          {/* Nothing anywhere → offer the tutor */}
          {results.length === 0 && !lessonsLoading && lessons.length === 0 && (
            <Link
              href="/chat"
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" /> Not found — ask Sensei about “
              {q.trim()}”
            </Link>
          )}
        </>
      )}
    </div>
  );
}
