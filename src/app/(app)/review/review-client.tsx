"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  RotateCcw,
  Brain,
  GraduationCap,
  Pencil,
  FastForward,
  Info,
  ExternalLink,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskSensei } from "@/components/ask-sensei/ask-sensei";
import { ConjugationTable } from "@/components/conjugation-table";
import { ItemImage } from "@/components/knowledge/item-image";
import { showReading, stripFurigana } from "@/lib/furigana";
import { posLabel } from "@/lib/conjugation";
import { RubyText } from "@/components/ruby-text";
import { SpeakButton } from "@/components/speak-button";
import { PitchAccent } from "@/components/pitch-accent";
import { PitchToggle } from "@/components/pitch-toggle";
import { PitchLegend } from "@/components/pitch-legend";
import { usePitch } from "@/lib/use-pitch";
import { playReveal, playGrade } from "@/lib/use-sound";
import { bumpReviewDue } from "@/lib/use-review-due";
import { masteryInfo, type MasteryLevel } from "@/lib/mastery";
import { sourceMeta } from "@/lib/source";
import { cn } from "@/lib/utils";
import {
  savePersonalNote,
  appendPersonalNote,
  setItemSuspended,
} from "./actions";
import { useReviewKeys, REVIEW_SHORTCUTS } from "./use-review-keys";
import {
  useReviewSession,
  saveReviewSession,
  clearReviewSession,
  isResumable,
} from "./use-review-session";
import type { Rating, IntervalPreview } from "@/lib/srs";

export type ReviewCard = {
  id: string;
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
  jlpt_level: string | null;
  part_of_speech: string | null;
  personal_note: string | null;
};

/** One kanji from the card's term, with a short gloss, for the reveal breakdown. */
export type KanjiGloss = { char: string; meaning: string };

/** Source/history/strength shown in the collapsible "details" panel. */
export type CardMeta = {
  sourceType: string | null;
  collectionTitle: string | null;
  pageRef: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  timesSeen: number;
  reps: number;
  /** FSRS-predicted recall % right now, or null for a brand-new item. */
  retr: number | null;
  mastery: MasteryLevel;
  /** Kanji in the term we have data for (char + primary meaning), for the
   *  tappable "Kanji" breakdown on the answer side. */
  kanji?: KanjiGloss[];
  /** Signed urls for the item's picture (shown on reveal), or null. */
  image?: { thumb: string; full: string } | null;
  imageSource?: string | null;
};

/** Today's plan, as the server computed it. Replaces the old uncapped
 *  `totalDue`: the headline number is now the work left TODAY, with the true
 *  pile reported separately as context. */
export type QueueSummary = {
  /** Cards in today's plan (the number the learner is asked to finish). */
  plannedToday: number;
  newCount: number;
  reviewCount: number;
  /** Reviews already logged today, across every surface (tests included). */
  doneToday: number;
  backlogReviews: number;
  backlogNew: number;
  daysToClear: number;
  reviewLimit: number;
  newLimit: number;
  nextResetIso: string;
  /** review_log missing → the cap is per-load, not per-day. Say so. */
  degradedLog: boolean;
  /** This batch was requested beyond the daily plan (?over=1). */
  overBudget: boolean;
};

const EMPTY_SUMMARY: QueueSummary = {
  plannedToday: 0,
  newCount: 0,
  reviewCount: 0,
  doneToday: 0,
  backlogReviews: 0,
  backlogNew: 0,
  daysToClear: 0,
  reviewLimit: 0,
  newLimit: 0,
  nextResetIso: "",
  degradedLog: false,
  overBudget: false,
};

const RATINGS: { rating: Rating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "bg-[#f43f5e] text-white" },
  { rating: "hard", label: "Hard", cls: "bg-[#f59e0b] text-white" },
  { rating: "good", label: "Good", cls: "bg-[#3b82f6] text-white" },
  { rating: "easy", label: "Easy", cls: "bg-[#10b981] text-white" },
];

// Color + light tint + glow for the on-grade gline flash. Reds for struggle, a
// bright sky-blue for "good" (distinct from the cobalt progress bar), a glowing
// super-green for "easy". `grad` draws the line as a soft gradient streak.
const FLASH: Record<
  Rating,
  { color: string; grad: string; glow: string; label: string }
> = {
  again: {
    color: "#f43f5e",
    grad: "linear-gradient(90deg, transparent, #f43f5e 22%, #ff8aa3 50%, #f43f5e 78%, transparent)",
    glow: "0 0 10px rgba(244,63,94,0.5)",
    label: "AGAIN",
  },
  hard: {
    color: "#f59e0b",
    grad: "linear-gradient(90deg, transparent, #f59e0b 22%, #ffd27a 50%, #f59e0b 78%, transparent)",
    glow: "0 0 10px rgba(245,158,11,0.5)",
    label: "HARD",
  },
  good: {
    color: "#3b82f6",
    grad: "linear-gradient(90deg, transparent, #3b82f6 22%, #93c5fd 50%, #3b82f6 78%, transparent)",
    glow: "0 0 14px rgba(59,130,246,0.6)",
    label: "GOOD",
  },
  easy: {
    color: "#10b981",
    grad: "linear-gradient(90deg, transparent, #10b981 20%, #6ee7b7 50%, #10b981 80%, transparent)",
    glow: "0 0 26px rgba(16,185,129,0.95)",
    label: "EASY",
  },
};

export function ReviewClient({
  cards,
  previews = {},
  summary,
  aheadCards = [],
  aheadPreviews = {},
  meta = {},
  single = false,
  nowMs,
  dayKey,
  canPark = false,
}: {
  cards: ReviewCard[];
  previews?: Record<string, IntervalPreview>;
  summary?: QueueSummary;
  aheadCards?: ReviewCard[];
  aheadPreviews?: Record<string, IntervalPreview>;
  meta?: Record<string, CardMeta>;
  /** Whether the Park control can be shown (migration 0024 applied). */
  canPark?: boolean;
  /** Server render time. Passed in rather than read with Date.now() so the
   *  resume check stays a pure render. */
  nowMs: number;
  /** The study day this page was built for (see lib/study-day). */
  dayKey?: string;
  /** Focused single-item review (from a library "Review" link): never persists
   *  or resumes a session. */
  single?: boolean;
}) {
  // Resume an in-progress session if one was saved, so leaving and coming back
  // keeps your place instead of restarting at item 1. sessionStorage clears when
  // the tab closes, so a resumed batch is always from the current sitting.
  // ...but only if it is still fresh (SESSION_TTL_MS) and belongs to the same
  // study day. A stale batch carries FSRS interval previews computed hours ago
  // and cards that may already have been graded elsewhere.
  const saved = useReviewSession();
  const useSaved = !single && isResumable(saved, dayKey, nowMs);

  const activeMode: "due" | "ahead" = useSaved ? saved!.mode : "due";
  const activeCards = useSaved ? saved!.cards : cards;
  const activePreviews = useSaved ? saved!.previews : previews;
  const activeMeta = useSaved ? saved!.meta : meta;
  const startIndex = useSaved ? saved!.index : 0;
  const startReviewed = useSaved ? saved!.reviewed : 0;
  const baseSummary = summary ?? {
    ...EMPTY_SUMMARY,
    plannedToday: cards.length,
  };
  const activeSummary = useSaved ? saved!.summary ?? baseSummary : baseSummary;
  // Stable across grades (so the card list doesn't remount mid-session); flips
  // once when a fresh batch first persists (fresh -> resume).
  const flashKey = single ? "single" : useSaved ? "resume" : "fresh";

  function persist(index: number, reviewed: number) {
    if (single) return;
    saveReviewSession({
      savedAt: useSaved ? saved!.savedAt : nowMs,
      mode: activeMode,
      dayKey,
      cards: activeCards,
      previews: activePreviews,
      meta: activeMeta,
      index,
      reviewed,
      totalDue: activeSummary.plannedToday,
      summary: activeSummary,
    });
  }

  function startAhead() {
    saveReviewSession({
      savedAt: nowMs,
      mode: "ahead",
      dayKey,
      cards: aheadCards,
      previews: aheadPreviews,
      meta,
      index: 0,
      reviewed: 0,
      totalDue: aheadCards.length,
      summary: { ...EMPTY_SUMMARY, plannedToday: aheadCards.length },
    });
  }

  return (
    <div className="mx-auto max-w-lg py-6">
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <Brain className="h-5 w-5 text-primary" /> Review
        </h1>
        <div className="flex items-center gap-2">
          <PitchToggle />
          <Link
            href="/tests"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <GraduationCap className="h-4 w-4" /> Practice tests
          </Link>
        </div>
      </div>
      <PitchLegend className="mb-4" />
      <Flashcards
        key={flashKey}
        cards={activeCards}
        previews={activePreviews}
        meta={activeMeta}
        summary={activeSummary}
        ahead={activeMode === "ahead"}
        aheadAvailable={single ? 0 : aheadCards.length}
        startIndex={startIndex}
        startReviewed={startReviewed}
        onStudyAhead={startAhead}
        onProgress={persist}
        onExit={single ? undefined : clearReviewSession}
        single={single}
        canPark={canPark}
      />
    </div>
  );
}

function Flashcards({
  cards,
  previews,
  meta = {},
  summary,
  ahead,
  aheadAvailable,
  startIndex = 0,
  startReviewed = 0,
  onStudyAhead,
  onProgress,
  onExit,
  single = false,
  canPark = false,
}: {
  cards: ReviewCard[];
  previews: Record<string, IntervalPreview>;
  meta?: Record<string, CardMeta>;
  summary: QueueSummary;
  ahead: boolean;
  aheadAvailable: number;
  /** Where to resume from when a saved session is restored. */
  startIndex?: number;
  startReviewed?: number;
  onStudyAhead: () => void;
  /** Persist progress (new index/reviewed) after each grade. */
  onProgress?: (index: number, reviewed: number) => void;
  /** Clear the saved session when the learner leaves the finished batch. */
  onExit?: () => void;
  /** Focused single-item review: never touches the live due badge. */
  single?: boolean;
  canPark?: boolean;
}) {
  const router = useRouter();
  const pitchOn = usePitch();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(startIndex);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(startReviewed);
  const [showDetails, setShowDetails] = useState(false);
  // Personal notes, seeded from the cards and updated as the learner edits/saves.
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(cards.map((c) => [c.id, c.personal_note ?? ""])),
  );
  const [editingNote, setEditingNote] = useState(false);
  // On-grade gline flash (keyed by seq so it replays each grade).
  const [flash, setFlash] = useState<{ rating: Rating; seq: number } | null>(
    null,
  );
  // In-flight guard for grade(): set on grade, cleared when the next card's
  // answer is revealed. A ref (not state) so it takes effect immediately rather
  // than on the next render — which is the whole point.
  const gradingRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);
  const [parking, setParking] = useState(false);
  const flashSeqRef = useRef(0);
  // Wrapper around the card's SpeakButton, so the "S" shortcut can reuse its
  // exact click path rather than duplicating the speech-synthesis logic.
  const speakRef = useRef<HTMLSpanElement>(null);

  const backlogTotal = summary.backlogReviews + summary.backlogNew;
  // Is there a card on screen? `card` is only defined past the early returns
  // below, so every keyboard handler must be inert when this is false.
  const onCard = cards.length > 0 && index < cards.length;

  /** Reveal the answer. Shared by the button and the keyboard handler. */
  function reveal() {
    if (revealed) return;
    gradingRef.current = false;
    setRevealed(true);
    playReveal();
  }

  // Anki-compatible bindings. grade() is a hoisted function declaration further
  // down, so these closures can call it even though it is defined after the
  // early returns; `onCard` keeps them inert when it would be unsafe.
  useReviewKeys(
    {
      reveal: () => (revealed ? grade("good") : reveal()),
      again: () => revealed && grade("again"),
      hard: () => revealed && grade("hard"),
      good: () => revealed && grade("good"),
      easy: () => revealed && grade("easy"),
      speak: () => speakRef.current?.querySelector("button")?.click(),
      details: () => setShowDetails((v) => !v),
      note: () => revealed && setEditingNote(true),
      help: () => setShowHelp((v) => !v),
      escape: () => {
        if (editingNote) setEditingNote(false);
        else if (showHelp) setShowHelp(false);
        else (document.activeElement as HTMLElement | null)?.blur();
      },
    },
    onCard,
  );

  if (cards.length === 0) {
    // An empty batch means one of two very different things, and saying "all
    // caught up" when a backlog is waiting would just be a lie.
    const budgetSpent = !ahead && backlogTotal > 0;
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">
          {budgetSpent ? "Today's done 🎉" : "Nothing due right now"}
        </h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          {budgetSpent ? (
            <>
              You&apos;ve finished today&apos;s plan.{" "}
              {backlogTotal.toLocaleString()} still waiting — about{" "}
              {Math.max(1, summary.daysToClear)}{" "}
              {Math.max(1, summary.daysToClear) === 1 ? "day" : "days"} at this
              pace. Come back tomorrow and it keeps shrinking.
            </>
          ) : (
            <>
              You are all caught up. New items become reviewable as you chat and
              make lessons; scheduled ones come back when they are due.
            </>
          )}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {budgetSpent ? (
            <>
              <Link href="/dashboard">
                <Button>See progress</Button>
              </Link>
              <Link
                href="/review?over=1"
                className="self-center text-xs text-muted underline underline-offset-4 hover:text-foreground"
              >
                Study beyond today&apos;s plan
              </Link>
            </>
          ) : (
            <>
              {aheadAvailable > 0 && (
                <Button onClick={onStudyAhead}>
                  <FastForward className="h-4 w-4" /> Study ahead ·{" "}
                  {aheadAvailable} cards
                </Button>
              )}
              <Link href="/chat">
                <Button variant={aheadAvailable > 0 ? "outline" : "primary"}>
                  Study something new
                </Button>
              </Link>
            </>
          )}
        </div>
        {!budgetSpent && aheadAvailable > 0 && (
          <p className="mx-auto mt-3 max-w-sm text-xs text-muted">
            These aren&apos;t due yet — get ahead on the ones closest to fading.
          </p>
        )}
      </div>
    );
  }

  if (index >= cards.length) {
    // What's left of TODAY'S plan — not the lifetime pile. Cards just graded are
    // rescheduled into the future, so anything still planned is beyond this
    // batch and needs a fresh server render to fetch.
    const remaining = ahead ? 0 : Math.max(0, summary.plannedToday - reviewed);
    const dayDone = !ahead && remaining === 0;
    const backlog = summary.backlogReviews + summary.backlogNew;
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">
          {ahead ? "Done! 🎉" : dayDone ? "Today's done 🎉" : "Batch done 🎉"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          You reviewed {reviewed} {reviewed === 1 ? "item" : "items"}.
          {ahead
            ? " Nice — you got ahead of the schedule."
            : remaining > 0
              ? ` ${remaining} left in today's plan.`
              : " That's the whole plan for today."}
        </p>
        {/* The backlog is context, not a demand: a finite pile with a date on
            it reads very differently from an ever-growing badge. */}
        {dayDone && backlog > 0 && (
          <p className="mx-auto mt-2 max-w-sm text-xs text-muted">
            {backlog.toLocaleString()} still waiting — about{" "}
            {Math.max(1, summary.daysToClear)}{" "}
            {Math.max(1, summary.daysToClear) === 1 ? "day" : "days"} at this
            pace. Nothing is lost by stopping here.
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" onClick={() => onExit?.()}>
            <Button variant={dayDone ? "primary" : "outline"}>
              See progress
            </Button>
          </Link>
          {!ahead && remaining > 0 ? (
            <Button
              onClick={() => {
                onExit?.();
                router.refresh();
              }}
            >
              Continue ({remaining} left today)
            </Button>
          ) : dayDone && backlog > 0 ? (
            // Opt-in, de-emphasised: a cap with no override turns a keen day
            // into a wall, and walls get features deleted.
            <Link
              href="/review?over=1"
              onClick={() => onExit?.()}
              className="self-center text-xs text-muted underline underline-offset-4 hover:text-foreground"
            >
              Study beyond today&apos;s plan
            </Link>
          ) : (
            <Link href="/chat" onClick={() => onExit?.()}>
              <Button>Study something new</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const card = cards[index];
  const note = notes[card.id] ?? "";
  const pos = posLabel(card.part_of_speech);
  const cardMeta = meta[card.id];

  function grade(rating: Rating) {
    // One grade per card, no matter how the input arrives. Nothing used to
    // guard this: the mouse path survived only because setRevealed(false)
    // unmounts the rating grid on the next render, which is far too slow to
    // stop OS key-repeat or a double-click. Released when the next card's
    // answer is revealed (see reveal()).
    if (gradingRef.current) return;
    if (!revealed) return;
    gradingRef.current = true;

    playGrade();
    // A monotonic counter, not Date.now(): two grades inside the same
    // millisecond would collide on a timestamp, and reading the clock here is
    // an impure call in a render-scoped function.
    const seq = ++flashSeqRef.current;
    setFlash({ rating, seq });
    window.setTimeout(
      () => setFlash((f) => (f?.seq === seq ? null : f)),
      reduce ? 350 : 700,
    );
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: card.id, rating }),
    }).catch(() => {});
    // The badge now means "work left today", and EVERY grade spends one unit of
    // the daily budget — including an "again" that returns in five minutes,
    // because the server counts review_log rows, which include relearning ones.
    // So this decrements unconditionally now; it used to fire only when the card
    // left the due set, which no longer matches what the number means.
    //
    // Skipped when reviewing ahead (not part of today's plan), in single-item
    // mode (a library "Review" link is usually not a due card, so decrementing
    // invented progress), and when studying past the cap.
    if (!ahead && !single && !summary.overBudget) bumpReviewDue(-1);
    // Safe to derive from this render's values: gradingRef guarantees only one
    // grade runs per card, so there is no second call in this tick reading the
    // same stale `index`.
    const nextIndex = index + 1;
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    setRevealed(false);
    setEditingNote(false);
    setShowDetails(false);
    setIndex(nextIndex);
    onProgress?.(nextIndex, nextReviewed);
  }

  /** Park the current word and move on WITHOUT grading it, so it never enters
   *  review_log and never spends a slot of today's budget. */
  async function park() {
    if (parking || gradingRef.current) return;
    setParking(true);
    const res = await setItemSuspended(card.id, true);
    setParking(false);
    if (!res.ok) return;
    if (!ahead && !single && !summary.overBudget) bumpReviewDue(-1);
    const nextIndex = index + 1;
    setRevealed(false);
    setEditingNote(false);
    setShowDetails(false);
    setIndex(nextIndex);
    onProgress?.(nextIndex, reviewed);
  }

  async function saveNote(value: string) {
    setNotes((n) => ({ ...n, [card.id]: value }));
    setEditingNote(false);
    await savePersonalNote(card.id, value);
  }

  async function onSaveToNote(content: string) {
    // Save the tutor's reply verbatim — no AI summarizing (free, keeps the full
    // answer the learner wanted to keep).
    const res = await appendPersonalNote(card.id, content);
    if (res.ok && res.note != null) {
      setNotes((n) => ({ ...n, [card.id]: res.note! }));
    }
  }

  return (
    <div className="relative">
      {/* On-grade gline flash — color + glow encode how the answer went.
          Viewport-fixed at the bottom-center of the content column so it's
          always visible no matter how far the card/notes are scrolled, clear of
          the top progress bar, and above the mobile bottom nav. */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key={flash.seq}
            aria-hidden="true"
            initial={{ opacity: 0, y: 10, scaleX: 0.3 }}
            animate={{ opacity: 1, y: 0, scaleX: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none fixed bottom-[calc(var(--bottom-nav)_+_1.25rem)] left-1/2 z-[60] flex -translate-x-1/2 flex-col-reverse items-center gap-1.5 md:left-[calc(50%_+_7.5rem)]"
          >
            <div
              className="h-[3px] w-64 max-w-[80vw] rounded-full"
              style={{
                background: FLASH[flash.rating].grad,
                boxShadow: FLASH[flash.rating].glow,
              }}
            />
            <span className="mono" style={{ color: FLASH[flash.rating].color }}>
              {FLASH[flash.rating].label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {ahead && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
          Reviewing ahead — these aren&apos;t due yet.
        </div>
      )}
      <div className="mb-1 flex items-center justify-between text-sm text-muted">
        <span>
          Review · {index + 1} / {cards.length}
          {!ahead && (
            <span className="ml-2 text-foreground">
              · {Math.max(0, summary.plannedToday - reviewed)} left today
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> spaced repetition
        </span>
      </div>
      {/* The pile, stated once, quietly, with an end date on it. */}
      {!ahead && !summary.degradedLog && backlogTotal > 0 && (
        <p className="mb-3 text-xs text-muted">
          {backlogTotal.toLocaleString()} more waiting · about{" "}
          {Math.max(1, summary.daysToClear)}{" "}
          {Math.max(1, summary.daysToClear) === 1 ? "day" : "days"} at this pace
        </p>
      )}
      {summary.overBudget && (
        <p className="mb-3 text-xs text-primary">
          Studying beyond today&apos;s plan.
        </p>
      )}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      {/* `mode="wait"` stays — the cards are in normal flow, so overlapping
          them would stack two and jump the layout. But exit-then-enter at 0.18s
          each was ~360ms of churn per card, the real ceiling on how fast you can
          key through a deck; 0.09 halves it and still reads as a transition. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: reduce ? 0 : -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : 8 }}
          transition={{ duration: 0.09 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 text-center"
        >
          {/* Sweep light bar — re-fires on advance (card id) and on reveal. */}
          {!reduce && (
            <span
              key={`sweep-${card.id}-${revealed}`}
              aria-hidden
              className="card-sweep"
            />
          )}
          <div className="mb-3 flex flex-wrap justify-center gap-2 text-xs">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
              {card.type}
            </span>
            {card.jlpt_level && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                {card.jlpt_level}
              </span>
            )}
            {revealed && pos && (
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent">
                {pos}
              </span>
            )}
            {cardMeta && (
              <button
                onClick={() => setShowDetails((s) => !s)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 transition-colors",
                  showDetails
                    ? "bg-primary/10 text-primary"
                    : "bg-surface-2 text-muted hover:text-foreground",
                )}
                aria-expanded={showDetails}
              >
                <Info className="h-3 w-3" /> details
              </button>
            )}
          </div>

          {showDetails && cardMeta && (
            <div className="mb-4 space-y-1 rounded-xl border border-border bg-surface-2/40 px-3 py-2 text-left text-xs text-muted">
              <div className="flex items-center gap-1.5">
                <span>{sourceMeta(cardMeta.sourceType).emoji}</span>
                <span className="font-medium text-foreground">
                  {cardMeta.collectionTitle ??
                    sourceMeta(cardMeta.sourceType).label}
                </span>
                {cardMeta.pageRef && <span>· {cardMeta.pageRef}</span>}
              </div>
              {cardMeta.lessonId && (
                <Link
                  href={`/lessons/${cardMeta.lessonId}`}
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {cardMeta.lessonTitle ?? "Open lesson"}
                </Link>
              )}
              <div>
                Reviewed {cardMeta.reps}× · seen {cardMeta.timesSeen}× in study
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    masteryInfo(cardMeta.mastery).dot,
                  )}
                />
                {cardMeta.retr != null
                  ? `Memory strength ~${cardMeta.retr}% · ${masteryInfo(cardMeta.mastery).label}`
                  : "New — not scheduled yet"}
              </div>
              {/* Words arrive here automatically from chats and photographed
                  pages, so some of them are simply not worth studying. Parking
                  removes one from the queues for good without deleting it —
                  it stays in the library and can be brought back. */}
              {canPark && (
                <button
                  onClick={park}
                  disabled={parking}
                  className="mt-1 flex items-center gap-1 text-[11px] text-muted underline underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <Archive className="h-3 w-3" />
                  {parking ? "Parking…" : "Park this word (stop reviewing it)"}
                </button>
              )}
            </div>
          )}

          <div
            className={cn(
              "font-jp text-3xl font-semibold",
              !reduce && "glitch-in",
            )}
          >
            <RubyText>{card.term}</RubyText>
          </div>
          <div className="mt-2 flex justify-center">
            <span ref={speakRef}>
              <SpeakButton text={stripFurigana(card.reading || card.term)} />
            </span>
          </div>

          {revealed ? (
            <div
              className={cn(
                "mt-5 space-y-3 text-left",
                !reduce && "glitch-in",
              )}
            >
              {showReading(card.term, card.reading) &&
                (pitchOn ? (
                  <PitchAccent
                    term={card.term}
                    reading={card.reading!}
                    className="text-lg text-muted"
                  />
                ) : (
                  <p className="font-jp text-lg text-muted">{card.reading}</p>
                ))}
              {card.meaning && <p className="text-base">{card.meaning}</p>}
              {card.example && (
                <p className="font-jp text-sm text-muted">
                  <RubyText>{card.example}</RubyText>
                </p>
              )}

              <ItemImage
                itemId={card.id}
                term={stripFurigana(card.term)}
                meaning={card.meaning}
                reading={card.reading}
                initial={cardMeta?.image ?? null}
                initialSource={cardMeta?.imageSource ?? null}
              />

              {cardMeta?.kanji && cardMeta.kanji.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted">Kanji:</span>
                  {cardMeta.kanji.map((k) => (
                    <Link
                      key={k.char}
                      href={`/kanji/${encodeURIComponent(k.char)}?ret=review`}
                      className="flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 transition-colors hover:bg-surface"
                    >
                      <span className="font-jp text-sm">{k.char}</span>
                      {k.meaning && (
                        <span className="text-[11px] text-muted">{k.meaning}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}

              <ConjugationTable
                term={card.term}
                reading={card.reading}
                pos={card.part_of_speech}
              />

              {/* Personal note */}
              {editingNote ? (
                <NoteEditor
                  initial={note}
                  onSave={saveNote}
                  onCancel={() => setEditingNote(false)}
                />
              ) : note ? (
                <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2">
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted">
                    My note
                    <button
                      onClick={() => setEditingNote(true)}
                      className="ml-auto flex items-center gap-1 hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{note}</p>
                </div>
              ) : (
                <button
                  onClick={() => setEditingNote(true)}
                  className="flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
                >
                  <Pencil className="h-3 w-3" /> Add a personal note
                </button>
              )}
            </div>
          ) : (
            <div className="mt-8">
              <Button onClick={reveal} size="lg">
                Show answer
              </Button>
              <p className="kbd-hint mt-3 items-center justify-center gap-1.5 text-[11px] text-muted">
                press <span className="kbd">Space</span>
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map((r, i) => {
            const eta = previews[card.id]?.[r.rating];
            return (
              <button
                key={r.rating}
                onClick={() => grade(r.rating)}
                aria-label={`${r.label}${eta ? ` — next in ${eta}` : ""}`}
                aria-keyshortcuts={String(i + 1)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${r.cls}`}
              >
                {/* Desktop-only digit hint, in the editorial mono label style. */}
                <span className="kbd-hint absolute left-1.5 top-1 text-[9px] font-normal opacity-70">
                  {i + 1}
                </span>
                {r.label}
                {eta && (
                  <span className="text-[10px] font-normal opacity-80">
                    {eta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Shortcut cheatsheet ("?"). Desktop-only affordance, but rendered on
          demand so it never occupies layout. */}
      {showHelp && (
        <div className="kbd-hint mt-4 flex-col gap-1 rounded-xl border border-border bg-surface-2/50 px-3 py-2.5 text-xs text-muted">
          <div className="mono mb-1 text-[10px]">KEYBOARD</div>
          {REVIEW_SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-baseline gap-2">
              <span className="kbd shrink-0">{s.keys}</span>
              <span>{s.what}</span>
            </div>
          ))}
        </div>
      )}

      <AskSensei
        context={{
          kind: "vocab",
          item: {
            type: card.type,
            term: card.term,
            reading: card.reading,
            meaning: card.meaning,
            example: card.example,
            jlpt_level: card.jlpt_level,
          },
        }}
        contextKey={`card-${card.id}`}
        suggestions={[
          "Explain this word in depth.",
          "Give me another example sentence.",
          "What's an easy way to remember this?",
        ]}
        onSaveToNote={onSaveToNote}
      />
    </div>
  );
}

function NoteEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="rounded-xl border border-border bg-surface-2/40 px-3 py-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Your own note — a mnemonic, a nuance, an example…"
        className="w-full resize-none rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(value)}>
          Save note
        </Button>
      </div>
    </div>
  );
}
