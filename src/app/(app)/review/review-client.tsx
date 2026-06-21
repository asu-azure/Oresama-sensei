"use client";

import { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AskSensei } from "@/components/ask-sensei/ask-sensei";
import { ConjugationTable } from "@/components/conjugation-table";
import { showReading, stripFurigana } from "@/lib/furigana";
import { posLabel } from "@/lib/conjugation";
import { RubyText } from "@/components/ruby-text";
import { SpeakButton } from "@/components/speak-button";
import { PitchAccent } from "@/components/pitch-accent";
import { PitchToggle } from "@/components/pitch-toggle";
import { PitchLegend } from "@/components/pitch-legend";
import { usePitch } from "@/lib/use-pitch";
import { playReveal, playGrade } from "@/lib/use-sound";
import { masteryInfo, type MasteryLevel } from "@/lib/mastery";
import { sourceMeta } from "@/lib/source";
import { cn } from "@/lib/utils";
import { savePersonalNote, appendNoteSummary } from "./actions";
import {
  useReviewSession,
  saveReviewSession,
  clearReviewSession,
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
};

const RATINGS: { rating: Rating; label: string; cls: string }[] = [
  { rating: "again", label: "Again", cls: "bg-accent text-white" },
  { rating: "hard", label: "Hard", cls: "bg-surface-2 text-foreground" },
  { rating: "good", label: "Good", cls: "bg-primary text-primary-foreground" },
  { rating: "easy", label: "Easy", cls: "bg-emerald-600 text-white" },
];

export function ReviewClient({
  cards,
  previews = {},
  totalDue,
  aheadCards = [],
  aheadPreviews = {},
  meta = {},
  single = false,
}: {
  cards: ReviewCard[];
  previews?: Record<string, IntervalPreview>;
  totalDue?: number;
  aheadCards?: ReviewCard[];
  aheadPreviews?: Record<string, IntervalPreview>;
  meta?: Record<string, CardMeta>;
  /** Focused single-item review (from a library "Review" link): never persists
   *  or resumes a session. */
  single?: boolean;
}) {
  // Resume an in-progress session if one was saved, so leaving and coming back
  // keeps your place instead of restarting at item 1. sessionStorage clears when
  // the tab closes, so a resumed batch is always from the current sitting.
  const saved = useReviewSession();
  const useSaved = !single && saved != null;

  const activeMode: "due" | "ahead" = useSaved ? saved!.mode : "due";
  const activeCards = useSaved ? saved!.cards : cards;
  const activePreviews = useSaved ? saved!.previews : previews;
  const activeMeta = useSaved ? saved!.meta : meta;
  const startIndex = useSaved ? saved!.index : 0;
  const startReviewed = useSaved ? saved!.reviewed : 0;
  const activeTotalDue = useSaved ? saved!.totalDue : totalDue ?? cards.length;
  // Stable across grades (so the card list doesn't remount mid-session); flips
  // once when a fresh batch first persists (fresh -> resume).
  const flashKey = single ? "single" : useSaved ? "resume" : "fresh";

  function persist(index: number, reviewed: number) {
    if (single) return;
    saveReviewSession({
      savedAt: useSaved ? saved!.savedAt : Date.now(),
      mode: activeMode,
      cards: activeCards,
      previews: activePreviews,
      meta: activeMeta,
      index,
      reviewed,
      totalDue: activeTotalDue,
    });
  }

  function startAhead() {
    saveReviewSession({
      savedAt: Date.now(),
      mode: "ahead",
      cards: aheadCards,
      previews: aheadPreviews,
      meta,
      index: 0,
      reviewed: 0,
      totalDue: aheadCards.length,
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
        totalDue={activeTotalDue}
        ahead={activeMode === "ahead"}
        aheadAvailable={single ? 0 : aheadCards.length}
        startIndex={startIndex}
        startReviewed={startReviewed}
        onStudyAhead={startAhead}
        onProgress={persist}
        onExit={single ? undefined : clearReviewSession}
      />
    </div>
  );
}

function Flashcards({
  cards,
  previews,
  meta = {},
  totalDue,
  ahead,
  aheadAvailable,
  startIndex = 0,
  startReviewed = 0,
  onStudyAhead,
  onProgress,
  onExit,
}: {
  cards: ReviewCard[];
  previews: Record<string, IntervalPreview>;
  meta?: Record<string, CardMeta>;
  totalDue: number;
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
}) {
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

  if (cards.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Nothing due right now</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          You are all caught up. New items become reviewable as you chat and make
          lessons; scheduled ones come back when they are due.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {aheadAvailable > 0 && (
            <Button onClick={onStudyAhead}>
              <FastForward className="h-4 w-4" /> Study ahead · {aheadAvailable} cards
            </Button>
          )}
          <Link href="/chat">
            <Button variant={aheadAvailable > 0 ? "outline" : "primary"}>
              Study something new
            </Button>
          </Link>
        </div>
        {aheadAvailable > 0 && (
          <p className="mx-auto mt-3 max-w-sm text-xs text-muted">
            These aren&apos;t due yet — get ahead on the ones closest to fading.
          </p>
        )}
      </div>
    );
  }

  if (index >= cards.length) {
    // Cards just graded are rescheduled into the future, so anything still due
    // is beyond this batch. Force a fresh load to pull the next due cards.
    const remaining = ahead ? 0 : Math.max(0, totalDue - reviewed);
    return (
      <div className="py-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">Done! 🎉</h1>
        <p className="mt-1 text-sm text-muted">
          You reviewed {reviewed} {reviewed === 1 ? "item" : "items"}.
          {ahead
            ? " Nice — you got ahead of the schedule."
            : remaining > 0
              ? ` ${remaining} still due.`
              : " You're all caught up."}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/dashboard" onClick={() => onExit?.()}>
            <Button variant="outline">See progress</Button>
          </Link>
          {!ahead && remaining > 0 ? (
            <Button
              onClick={() => {
                onExit?.();
                window.location.assign("/review");
              }}
            >
              Keep studying ({remaining} due)
            </Button>
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
    playGrade();
    fetch("/api/srs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: card.id, rating }),
    }).catch(() => {});
    const nextIndex = index + 1;
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    setRevealed(false);
    setEditingNote(false);
    setShowDetails(false);
    setIndex(nextIndex);
    onProgress?.(nextIndex, nextReviewed);
  }

  async function saveNote(value: string) {
    setNotes((n) => ({ ...n, [card.id]: value }));
    setEditingNote(false);
    await savePersonalNote(card.id, value);
  }

  async function onSaveToNote(content: string) {
    // Save a concise 1-line summary of the reply (not the whole answer).
    const res = await appendNoteSummary(card.id, content);
    if (res.ok && res.note != null) {
      setNotes((n) => ({ ...n, [card.id]: res.note! }));
    }
  }

  return (
    <>
      {ahead && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-center text-xs text-primary">
          Reviewing ahead — these aren&apos;t due yet.
        </div>
      )}
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>
          Review · {index + 1} / {cards.length}
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3.5 w-3.5" /> spaced repetition
        </span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(index / cards.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: reduce ? 0 : -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: reduce ? 0 : 8 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-border bg-surface p-8 text-center"
        >
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
            <SpeakButton text={stripFurigana(card.reading || card.term)} />
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

              {cardMeta?.kanji && cardMeta.kanji.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted">Kanji:</span>
                  {cardMeta.kanji.map((k) => (
                    <Link
                      key={k.char}
                      href={`/kanji/${encodeURIComponent(k.char)}`}
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
              <Button
                onClick={() => {
                  setRevealed(true);
                  playReveal();
                }}
                size="lg"
              >
                Show answer
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {RATINGS.map((r) => {
            const eta = previews[card.id]?.[r.rating];
            return (
              <button
                key={r.rating}
                onClick={() => grade(r.rating)}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2.5 text-sm font-medium transition-transform active:scale-95 ${r.cls}`}
              >
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
    </>
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
