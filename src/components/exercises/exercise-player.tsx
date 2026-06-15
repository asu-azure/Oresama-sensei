"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X, ArrowRight, RotateCcw, Trophy } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { RubyText } from "@/components/ruby-text";
import { Button } from "@/components/ui/button";
import { stripFurigana } from "@/lib/furigana";
import { cn } from "@/lib/utils";
import type {
  Exercise,
  McqExercise,
  ArrangeExercise,
  ClozeExercise,
} from "@/lib/types";

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
}: {
  exercises: Exercise[];
  onGrade?: (itemId: string, correct: boolean) => void;
  onDone?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [cardKey, setCardKey] = useState(0);

  if (exercises.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No exercises available.
      </p>
    );
  }

  if (index >= exercises.length) {
    const pct = Math.round((correctCount / exercises.length) * 100);
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
          {correctCount} / {exercises.length} correct ({pct}%)
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setIndex(0);
              setCorrectCount(0);
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

  const ex = exercises[index];

  function handleAnswered(correct: boolean) {
    if (correct) setCorrectCount((n) => n + 1);
    if (ex.item_id && onGrade) onGrade(ex.item_id, correct);
  }

  function next() {
    setIndex((i) => i + 1);
    setCardKey((k) => k + 1);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>
          Exercise {index + 1} / {exercises.length}
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs uppercase tracking-wide">
          {ex.type === "mcq"
            ? "Multiple choice"
            : ex.type === "arrange"
              ? "Arrange"
              : "Fill the blank"}
        </span>
      </div>
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <motion.div
          className="h-full bg-primary"
          initial={false}
          animate={{ width: `${(index / exercises.length) * 100}%` }}
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
            <McqView ex={ex} onAnswered={handleAnswered} onNext={next} />
          )}
          {ex.type === "arrange" && (
            <ArrangeView ex={ex} onAnswered={handleAnswered} onNext={next} />
          )}
          {ex.type === "cloze" && (
            <ClozeView ex={ex} onAnswered={handleAnswered} onNext={next} />
          )}
        </motion.div>
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
}: {
  ex: McqExercise;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const correct = picked === ex.answer;

  function choose(i: number) {
    if (done) return;
    setPicked(i);
    onAnswered(i === ex.answer);
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
}: {
  ex: ArrangeExercise;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const pool = useMemo(
    () => shuffle(ex.tokens.map((t, i) => ({ t, i }))),
    [ex],
  );
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);

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
    setChecked(true);
    onAnswered(correct);
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

function ClozeView({
  ex,
  onAnswered,
  onNext,
}: {
  ex: ClozeExercise;
  onAnswered: (correct: boolean) => void;
  onNext: () => void;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const hasChoices = !!(ex.choices && ex.choices.length > 0);
  const correct = norm((hasChoices ? picked : value) ?? "") === norm(ex.answer);

  function pick(c: string) {
    if (checked) return;
    setPicked(c);
    setChecked(true);
    onAnswered(norm(c) === norm(ex.answer));
  }
  function check() {
    if (checked || !value.trim()) return;
    setChecked(true);
    onAnswered(norm(value) === norm(ex.answer));
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