"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Trophy,
  Wand2,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Markdown } from "@/components/markdown";
import { RubyText } from "@/components/ruby-text";
import { Button } from "@/components/ui/button";
import { ExerciseDiscussPanel } from "@/components/exercises/exercise-discuss-panel";
import { stripFurigana } from "@/lib/furigana";
import { cn } from "@/lib/utils";
import type {
  Exercise,
  McqExercise,
  ArrangeExercise,
  ClozeExercise,
  DiscussMessage,
} from "@/lib/types";

// --- Snapshot types for back-navigation state restoration ---

type McqSnapshot = { type: "mcq"; picked: number };
type ArrangeSnapshot = { type: "arrange"; builtTexts: string[] };
type StarArrangeSnapshot = { type: "star"; slots: (string | null)[] };
type ClozeSnapshot = { type: "cloze"; value: string; picked: string | null };
export type ExerciseSnapshot =
  | McqSnapshot
  | ArrangeSnapshot
  | StarArrangeSnapshot
  | ClozeSnapshot;

type HistoryEntry = {
  answered: boolean;
  correct: boolean | null;
  snapshot: ExerciseSnapshot | null;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function norm(s: string): string {
  return stripFurigana(s).replace(/\s+/g, "").trim();
}

export function ExercisePlayer({
  exercises,
  onGrade,
  onDone,
  onRefine,
}: {
  exercises: Exercise[];
  onGrade?: (itemId: string, correct: boolean) => void;
  onDone?: () => void;
  onRefine?: (index: number, ex: Exercise) => Promise<Exercise | null>;
}) {
  const [index, setIndex] = useState(0);
  const [cardKey, setCardKey] = useState(0);
  const [items, setItems] = useState<Exercise[]>(exercises);
  const [refining, setRefining] = useState(false);
  const [refineNote, setRefineNote] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    exercises.map(() => ({ answered: false, correct: null, snapshot: null })),
  );
  const [chatByIndex, setChatByIndex] = useState<
    Record<number, DiscussMessage[]>
  >({});
  const [chatOpen, setChatOpen] = useState(false);

  const correctCount = history.filter((h) => h.correct === true).length;
  const answeredCount = history.filter((h) => h.answered).length;

  async function checkAndFix() {
    if (!onRefine || refining) return;
    setRefining(true);
    setRefineNote(null);
    try {
      const fixed = await onRefine(index, items[index]);
      if (fixed) {
        setItems((prev) => {
          const next = [...prev];
          next[index] = fixed;
          return next;
        });
        setHistory((prev) => {
          const next = [...prev];
          next[index] = { answered: false, correct: null, snapshot: null };
          return next;
        });
        setCardKey((k) => k + 1);
        setRefineNote("Question checked & refined.");
      } else {
        setRefineNote("Couldn't refine this one.");
      }
    } catch {
      setRefineNote("Couldn't refine this one.");
    } finally {
      setRefining(false);
    }
  }

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No exercises available.
      </p>
    );
  }

  if (index >= items.length) {
    const pct = Math.round((correctCount / items.length) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/10 text-emerald-600"
        >
          <Trophy className="h-6 w-6" />
        </motion.div>
        <h3 className="text-xl font-semibold">Practice complete</h3>
        <p className="mt-1 text-sm text-muted">
          {correctCount} / {items.length} correct ({pct}%)
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setHistory(
                items.map(() => ({
                  answered: false,
                  correct: null,
                  snapshot: null,
                })),
              );
              setChatByIndex({});
              setChatOpen(false);
              setCardKey((k) => k + 1);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          {onDone && <Button onClick={onDone}>Done</Button>}
        </div>
      </motion.div>
    );
  }

  const ex = items[index];
  const currentHistory = history[index];

  function handleAnswered(correct: boolean, snapshot: ExerciseSnapshot) {
    setHistory((prev) => {
      const next = [...prev];
      next[index] = { answered: true, correct, snapshot };
      return next;
    });
    if (ex.item_id && onGrade) onGrade(ex.item_id, correct);
  }

  function next() {
    setIndex((i) => i + 1);
    setCardKey((k) => k + 1);
    setChatOpen(false);
    setRefineNote(null);
  }

  function prev() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setCardKey((k) => k + 1);
    setChatOpen(false);
    setRefineNote(null);
  }

  return (
    <div>
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <div className="flex items-center gap-2">
          <button
            onClick={prev}
            disabled={index === 0}
            title="Previous question"
            className="flex items-center justify-center rounded-full border border-border p-1 transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <span>
            Exercise {index + 1} / {items.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onRefine && (
            <button
              onClick={checkAndFix}
              disabled={refining}
              title="Looks wrong? Ask AI to check & fix this question"
              className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs transition-colors hover:bg-surface-2 disabled:opacity-50"
            >
              {refining ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              Check &amp; fix
            </button>
          )}
          <button
            onClick={() => setChatOpen((o) => !o)}
            title="Ask AI about this question"
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:bg-surface-2",
              chatOpen
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border",
              chatByIndex[index]?.length
                ? "border-primary/40 text-primary"
                : "",
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Ask AI
          </button>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs uppercase tracking-wide">
            {ex.type === "mcq"
              ? "Multiple choice"
              : ex.type === "arrange"
                ? ex.star_index != null && ex.star_index >= 0
                  ? "Sentence ★"
                  : "Arrange"
                : "Fill the blank"}
          </span>
        </div>
      </div>

      {refineNote && (
        <p className="mb-2 text-xs text-muted">{refineNote}</p>
      )}

      {/* Progress bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${(answeredCount / items.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${index}-${cardKey}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {ex.type === "mcq" && (
            <McqView
              ex={ex}
              onAnswered={handleAnswered}
              onNext={next}
              initialSnapshot={
                currentHistory?.snapshot?.type === "mcq"
                  ? currentHistory.snapshot
                  : null
              }
            />
          )}
          {ex.type === "arrange" &&
            (ex.star_index != null && ex.star_index >= 0 ? (
              <StarArrangeView
                ex={ex}
                onAnswered={handleAnswered}
                onNext={next}
                initialSnapshot={
                  currentHistory?.snapshot?.type === "star"
                    ? currentHistory.snapshot
                    : null
                }
              />
            ) : (
              <ArrangeView
                ex={ex}
                onAnswered={handleAnswered}
                onNext={next}
                initialSnapshot={
                  currentHistory?.snapshot?.type === "arrange"
                    ? currentHistory.snapshot
                    : null
                }
              />
            ))}
          {ex.type === "cloze" && (
            <ClozeView
              ex={ex}
              onAnswered={handleAnswered}
              onNext={next}
              initialSnapshot={
                currentHistory?.snapshot?.type === "cloze"
                  ? currentHistory.snapshot
                  : null
              }
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* In-test AI chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <ExerciseDiscussPanel
            exercise={ex}
            messages={chatByIndex[index] ?? []}
            onMessages={(msgs) =>
              setChatByIndex((prev) => ({ ...prev, [index]: msgs }))
            }
            onClose={() => setChatOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      {children}
    </div>
  );
}

function Explanation({
  correct,
  text,
  onNext,
}: {
  correct: boolean;
  text: string;
  onNext: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-3"
    >
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border p-3 text-sm",
          correct
            ? "border-emerald-600/30 bg-emerald-600/10"
            : "border-accent/30 bg-accent/10",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white",
            correct ? "bg-emerald-600" : "bg-accent",
          )}
        >
          {correct ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
        </span>
        <div>
          <p className="font-medium">{correct ? "Correct" : "Not quite"}</p>
          {text && (
            <div className="mt-0.5 text-muted">
              <Markdown>{text}</Markdown>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={onNext} size="sm">
          Next <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function McqView({
  ex,
  onAnswered,
  onNext,
  initialSnapshot,
}: {
  ex: McqExercise;
  onAnswered: (correct: boolean, snapshot: ExerciseSnapshot) => void;
  onNext: () => void;
  initialSnapshot: McqSnapshot | null;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(
    initialSnapshot?.picked ?? null,
  );
  const done = picked !== null;
  const correct = picked === ex.answer;

  function choose(i: number) {
    if (done) return;
    setPicked(i);
    onAnswered(i === ex.answer, { type: "mcq", picked: i });
  }

  return (
    <Card>
      <div className="font-jp text-base">
        <Markdown>{ex.prompt}</Markdown>
      </div>
      <div className="mt-4 space-y-2">
        {ex.choices.map((c, i) => {
          const isAnswer = i === ex.answer;
          const isPicked = i === picked;
          return (
            <motion.button
              key={i}
              onClick={() => choose(i)}
              disabled={done}
              whileTap={reduce || done ? undefined : { scale: 0.98 }}
              animate={
                reduce || !done
                  ? undefined
                  : isAnswer
                    ? { scale: [1, 1.04, 1] }
                    : isPicked
                      ? { x: [0, -5, 5, -4, 4, 0] }
                      : undefined
              }
              transition={{ duration: 0.32 }}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-left font-jp text-sm transition-colors",
                !done && "border-border bg-background hover:bg-surface-2",
                done && isAnswer && "border-emerald-600/50 bg-emerald-600/10",
                done && isPicked && !isAnswer && "border-accent/50 bg-accent/10",
                done && !isAnswer && !isPicked && "border-border opacity-60",
              )}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-xs text-muted">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1">
                <RubyText>{c}</RubyText>
              </span>
              {done && isAnswer && (
                <Check className="h-4 w-4 text-emerald-600" />
              )}
              {done && isPicked && !isAnswer && (
                <X className="h-4 w-4 text-accent" />
              )}
            </motion.button>
          );
        })}
      </div>
      {done && (
        <Explanation correct={correct} text={ex.explanation} onNext={onNext} />
      )}
    </Card>
  );
}

function ArrangeView({
  ex,
  onAnswered,
  onNext,
  initialSnapshot,
}: {
  ex: ArrangeExercise;
  onAnswered: (correct: boolean, snapshot: ExerciseSnapshot) => void;
  onNext: () => void;
  initialSnapshot: ArrangeSnapshot | null;
}) {
  const reduce = useReducedMotion();
  const pool = useMemo(
    () => shuffle(ex.tokens.map((t, i) => ({ t, i }))),
    [ex],
  );

  const [order, setOrder] = useState<number[]>(() => {
    if (!initialSnapshot) return [];
    return initialSnapshot.builtTexts
      .map((t) => pool.findIndex((p) => p.t === t))
      .filter((i) => i !== -1);
  });
  const [checked, setChecked] = useState(initialSnapshot !== null);

  const used = new Set(order);
  const built = order.map((i) => pool[i].t);
  const correct = norm(built.join("")) === norm(ex.answer.join(""));

  function add(i: number) {
    if (checked || used.has(i)) return;
    setOrder((o) => [...o, i]);
  }
  function undo() {
    if (checked) return;
    setOrder((o) => o.slice(0, -1));
  }
  function check() {
    if (checked) return;
    const builtTexts = order.map((i) => pool[i].t);
    setChecked(true);
    onAnswered(correct, { type: "arrange", builtTexts });
  }

  return (
    <Card>
      <div className="text-sm">
        <Markdown>{ex.prompt}</Markdown>
      </div>

      <div className="mt-4 min-h-[3rem] rounded-xl border border-dashed border-border bg-background p-3">
        {order.length === 0 ? (
          <span className="text-sm text-muted">
            Tap the words below in order…
          </span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {built.map((t, k) => (
              <motion.span
                key={k}
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-lg bg-primary/10 px-3 py-1.5 font-jp text-sm text-primary"
              >
                <RubyText>{t}</RubyText>
              </motion.span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pool.map(({ t }, i) => (
          <motion.button
            key={i}
            onClick={() => add(i)}
            disabled={used.has(i) || checked}
            whileTap={reduce ? undefined : { scale: 0.94 }}
            className={cn(
              "rounded-lg border px-3 py-1.5 font-jp text-sm transition-colors",
              used.has(i)
                ? "border-border opacity-30"
                : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <RubyText>{t}</RubyText>
          </motion.button>
        ))}
      </div>

      {!checked ? (
        <div className="mt-4 flex justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={order.length === 0}
          >
            Undo
          </Button>
          <Button
            size="sm"
            onClick={check}
            disabled={order.length !== ex.tokens.length}
          >
            Check
          </Button>
        </div>
      ) : (
        <>
          {!correct && (
            <p className="mt-3 font-jp text-sm">
              <span className="text-muted">Answer: </span>
              <RubyText>{ex.answer.join(" ")}</RubyText>
            </p>
          )}
          <Explanation correct={correct} text={ex.explanation} onNext={onNext} />
        </>
      )}
    </Card>
  );
}

function StarArrangeView({
  ex,
  onAnswered,
  onNext,
  initialSnapshot,
}: {
  ex: ArrangeExercise;
  onAnswered: (correct: boolean, snapshot: ExerciseSnapshot) => void;
  onNext: () => void;
  initialSnapshot: StarArrangeSnapshot | null;
}) {
  const starIndex = ex.star_index ?? 0;
  const tiles = useMemo(
    () => shuffle(ex.tokens.map((t, i) => ({ id: `t${i}`, t }))),
    [ex],
  );
  const [slots, setSlots] = useState<(string | null)[]>(
    initialSnapshot?.slots ?? [null, null, null, null],
  );
  const [checked, setChecked] = useState(initialSnapshot !== null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
  );

  const tileOf = (id: string | null) =>
    id ? (tiles.find((x) => x.id === id) ?? null) : null;
  const placed = new Set(slots.filter((s): s is string => s !== null));
  const tray = tiles.filter((x) => !placed.has(x.id));
  const allFilled = slots.every((s) => s !== null);

  function placeFirstEmpty(id: string) {
    if (checked) return;
    setSlots((prev) => {
      if (prev.includes(id)) return prev;
      const empty = prev.indexOf(null);
      if (empty === -1) return prev;
      const next = [...prev];
      next[empty] = id;
      return next;
    });
  }
  function placeAt(slotIdx: number, id: string) {
    if (checked) return;
    setSlots((prev) => {
      if (prev[slotIdx] === id) return prev;
      const fromIdx = prev.indexOf(id);
      const occupant = prev[slotIdx];
      const next = [...prev];
      next[slotIdx] = id;
      if (fromIdx !== -1) next[fromIdx] = occupant;
      return next;
    });
  }
  function clearSlot(slotIdx: number) {
    if (checked) return;
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  }

  function onDragEnd(e: DragEndEvent) {
    if (checked) return;
    const id = String(e.active.id);
    const over = e.over?.id;
    if (over == null) return;
    if (typeof over === "string" && over.startsWith("slot-")) {
      placeAt(Number(over.slice(5)), id);
    } else if (over === "tray") {
      setSlots((prev) => prev.map((s) => (s === id ? null : s)));
    }
  }

  const starTile = tileOf(slots[starIndex]);
  const correct =
    !!starTile && norm(starTile.t) === norm(ex.answer[starIndex] ?? "");

  function check() {
    setChecked(true);
    onAnswered(correct, { type: "star", slots: [...slots] });
  }

  const [before, after] = ex.prompt.split("{{BLANKS}}");

  return (
    <Card>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="font-jp text-base leading-9">
          {before && <RubyText>{before}</RubyText>}
          <span className="mx-1 inline-flex flex-wrap items-center gap-1 align-middle">
            {slots.map((id, idx) => {
              const tile = tileOf(id);
              return (
                <Slot
                  key={idx}
                  idx={idx}
                  isStar={idx === starIndex}
                  disabled={checked}
                >
                  {tile ? (
                    <Tile
                      id={tile.id}
                      t={tile.t}
                      disabled={checked}
                      onClick={() => clearSlot(idx)}
                    />
                  ) : null}
                </Slot>
              );
            })}
          </span>
          {after && <RubyText>{after}</RubyText>}
        </div>

        <TrayDrop>
          {tray.length === 0 ? (
            <span className="text-xs text-muted">
              All placed — check your answer.
            </span>
          ) : (
            tray.map((tile) => (
              <Tile
                key={tile.id}
                id={tile.id}
                t={tile.t}
                disabled={checked}
                onClick={() => placeFirstEmpty(tile.id)}
              />
            ))
          )}
        </TrayDrop>
      </DndContext>

      {!checked ? (
        <div className="mt-4 flex justify-between">
          <p className="self-center text-xs text-muted">
            Drag or tap into the blanks · ★ is the answer
          </p>
          <Button size="sm" onClick={check} disabled={!allFilled}>
            Check
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-3 text-sm">
            <span className="text-muted">★ answer: </span>
            <span className="font-jp font-medium">
              <RubyText>{ex.answer[starIndex] ?? ""}</RubyText>
            </span>
            <span className="ml-3 text-muted">Full order: </span>
            <span className="font-jp">
              <RubyText>{ex.answer.join(" ")}</RubyText>
            </span>
          </p>
          <Explanation correct={correct} text={ex.explanation} onNext={onNext} />
        </>
      )}
    </Card>
  );
}

function Slot({
  idx,
  isStar,
  disabled,
  children,
}: {
  idx: number;
  isStar: boolean;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${idx}`, disabled });
  return (
    <span
      ref={setNodeRef}
      className={cn(
        "relative inline-flex min-h-[2.25rem] min-w-[3rem] items-center justify-center rounded-lg border-2 px-1 py-0.5 align-middle transition-colors",
        isStar ? "border-primary bg-primary/5" : "border-dashed border-border",
        isOver && "bg-primary/15",
      )}
    >
      {isStar && (
        <span className="absolute -right-1.5 -top-2 text-xs text-primary">
          ★
        </span>
      )}
      {children ?? <span className="text-muted">＿＿</span>}
    </span>
  );
}

function TrayDrop({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mt-4 flex min-h-[3rem] flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-background p-3 transition-colors",
        isOver && "bg-surface-2",
      )}
    >
      {children}
    </div>
  );
}

function Tile({
  id,
  t,
  disabled,
  onClick,
}: {
  id: string;
  t: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, listeners, attributes, isDragging, transform } =
    useDraggable({ id, disabled });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;
  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      disabled={disabled}
      {...listeners}
      {...attributes}
      className={cn(
        "touch-none rounded-lg border px-3 py-1.5 font-jp text-sm transition-colors",
        isDragging
          ? "border-primary bg-primary/10 opacity-80"
          : "border-border bg-surface hover:bg-surface-2",
      )}
    >
      <RubyText>{t}</RubyText>
    </button>
  );
}

function ClozeView({
  ex,
  onAnswered,
  onNext,
  initialSnapshot,
}: {
  ex: ClozeExercise;
  onAnswered: (correct: boolean, snapshot: ExerciseSnapshot) => void;
  onNext: () => void;
  initialSnapshot: ClozeSnapshot | null;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(initialSnapshot?.value ?? "");
  const [picked, setPicked] = useState<string | null>(
    initialSnapshot?.picked ?? null,
  );
  const [checked, setChecked] = useState(initialSnapshot !== null);
  const hasChoices = !!(ex.choices && ex.choices.length > 0);
  const correct = norm((hasChoices ? picked : value) ?? "") === norm(ex.answer);

  function pick(c: string) {
    if (checked) return;
    setPicked(c);
    setChecked(true);
    onAnswered(norm(c) === norm(ex.answer), {
      type: "cloze",
      value: "",
      picked: c,
    });
  }
  function check() {
    if (checked || !value.trim()) return;
    setChecked(true);
    onAnswered(norm(value) === norm(ex.answer), {
      type: "cloze",
      value,
      picked: null,
    });
  }

  return (
    <Card>
      <div className="font-jp text-base">
        <Markdown>{ex.prompt}</Markdown>
      </div>

      {hasChoices ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {ex.choices!.map((c, i) => {
            const isAnswer = norm(c) === norm(ex.answer);
            const isPicked = c === picked;
            return (
              <motion.button
                key={i}
                onClick={() => pick(c)}
                disabled={checked}
                whileTap={reduce || checked ? undefined : { scale: 0.96 }}
                className={cn(
                  "rounded-xl border px-4 py-2 font-jp text-sm transition-colors",
                  !checked && "border-border bg-background hover:bg-surface-2",
                  checked && isAnswer && "border-emerald-600/50 bg-emerald-600/10",
                  checked &&
                    isPicked &&
                    !isAnswer &&
                    "border-accent/50 bg-accent/10",
                )}
              >
                <RubyText>{c}</RubyText>
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") check();
            }}
            disabled={checked}
            placeholder="Type the missing word…"
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            size="sm"
            onClick={check}
            disabled={checked || !value.trim()}
          >
            Check
          </Button>
        </div>
      )}

      {checked && (
        <>
          {!correct && (
            <p className="mt-3 font-jp text-sm">
              <span className="text-muted">Answer: </span>
              <RubyText>{ex.answer}</RubyText>
            </p>
          )}
          <Explanation correct={correct} text={ex.explanation} onNext={onNext} />
        </>
      )}
    </Card>
  );
}
