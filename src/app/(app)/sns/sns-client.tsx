"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { PageHeading } from "@/components/motion/page-heading";
import {
  AtSign,
  Loader2,
  Copy,
  Check,
  Sparkles,
  History,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { RubyText } from "@/components/ruby-text";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { AskSensei } from "@/components/ask-sensei/ask-sensei";
import { stripFurigana, furiganaToRuby } from "@/lib/furigana";
import { cn } from "@/lib/utils";
import type {
  SnsMode,
  SnsRegister,
  SnsResult,
  SnsInteraction,
  SnsReview,
} from "@/lib/types";

const MODES: { value: SnsMode; label: string; hint: string }[] = [
  { value: "reply", label: "Reply", hint: "Answer someone's post or message" },
  { value: "compose", label: "New post", hint: "Phrase your own tweet" },
  { value: "explain", label: "Explain", hint: "Decode what a message means" },
];

const REGISTERS: { value: SnsRegister; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly-polite" },
  { value: "polite", label: "Polite" },
];

/** Plain Japanese (no furigana parentheses) for copying into X. */
function plainJa(s: string): string {
  return stripFurigana(furiganaToRuby(s));
}

export function SnsClient({
  initialHistory,
}: {
  initialHistory: SnsInteraction[];
}) {
  const [mode, setMode] = useState<SnsMode>("reply");
  const [register, setRegister] = useState<SnsRegister>("friendly");
  const [posted, setPosted] = useState("");
  const [incoming, setIncoming] = useState("");
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SnsResult | null>(null);
  const [history, setHistory] = useState<SnsInteraction[]>(initialHistory);
  const [copied, setCopied] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // "Edit & check" — the learner edits one option to their taste and gets
  // teacher feedback on their OWN version (which is then logged for growth).
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [review, setReview] = useState<SnsReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const hasInput = !!(posted.trim() || incoming.trim() || intent.trim());

  async function generate() {
    if (busy || !hasInput) return;
    setBusy(true);
    setError(null);
    resetEditor();
    const inputs = { mode, register, posted, incoming, intent };
    try {
      const res = await fetch("/api/sns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || "Something went wrong.",
        );
      }
      const data = (await res.json()) as SnsResult & { id: string | null };
      setResult(data);
      setHistory((h) => [
        {
          id: data.id ?? crypto.randomUUID(),
          inputs: { mode, register, posted, incoming, intent },
          options: data.options,
          note: data.note,
          explanation: data.explanation,
          created_at: new Date().toISOString(),
        },
        ...h,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string, idx: number) {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(idx);
        setTimeout(() => setCopied((c) => (c === idx ? null : c)), 1500);
      },
      () => {},
    );
  }

  function resetEditor() {
    setEditIdx(null);
    setEditText("");
    setReview(null);
    setReviewError(null);
  }

  // Open the inline editor for an option, pre-filled with its Japanese (furigana
  // stripped so it's easy to edit), or close it if it's already open.
  function toggleEditor(idx: number, japanese: string) {
    if (editIdx === idx) {
      resetEditor();
      return;
    }
    setEditIdx(idx);
    setEditText(plainJa(japanese));
    setReview(null);
    setReviewError(null);
  }

  async function checkDraft(original: string) {
    const draft = editText.trim();
    if (reviewBusy || !draft) return;
    setReviewBusy(true);
    setReviewError(null);
    setReview(null);
    try {
      const res = await fetch("/api/sns/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft, original, situation, register }),
      });
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => "")) || "Couldn't review that.",
        );
      }
      const data = (await res.json()) as SnsReview & { id: string | null };
      setReview(data);
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Couldn't review that.");
    } finally {
      setReviewBusy(false);
    }
  }

  function loadFromHistory(it: SnsInteraction) {
    setMode(it.inputs.mode);
    setRegister(it.inputs.register);
    setPosted(it.inputs.posted ?? "");
    setIncoming(it.inputs.incoming ?? "");
    setIntent(it.inputs.intent ?? "");
    setResult({
      options: it.options,
      note: it.note,
      explanation: it.explanation,
    });
    resetEditor();
    setShowHistory(false);
  }

  // Ground the refine chat in the current request.
  const situation = [posted, incoming].filter(Boolean).join(" / ");

  return (
    <div className="mx-auto max-w-2xl py-6">
      <PageHeading
        kicker="@ — SOCIAL JAPANESE"
        title="SNS helper"
        jp="投稿サポート"
        subtitle="Draft natural Japanese for X — replies, posts, or decode what someone means. You get a few options with Thai nuance; refine by chatting."
      />

      {/* Mode */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "rounded-xl border px-3 py-2 text-center transition-colors",
              mode === m.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-muted hover:bg-surface-2",
            )}
          >
            <div className="text-sm font-medium">{m.label}</div>
            <div className="mt-0.5 text-[10px] leading-tight">{m.hint}</div>
          </button>
        ))}
      </div>

      {/* Register (not for explain) */}
      {mode !== "explain" && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-xs text-muted">Tone:</span>
          <div className="flex flex-wrap gap-1.5">
            {REGISTERS.map((r) => (
              <button
                key={r.value}
                onClick={() => setRegister(r.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  register === r.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted hover:bg-surface-2",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inputs */}
      <div className="space-y-3">
        {mode === "explain" ? (
          <Field
            label="The message to decode"
            placeholder="Paste the Japanese tweet / reply / DM…"
            value={incoming}
            onChange={setIncoming}
            rows={3}
          />
        ) : (
          <>
            {mode === "reply" && (
              <Field
                label="Their message you're reacting to"
                placeholder="例：「この絵、すごく好きです！」"
                value={incoming}
                onChange={setIncoming}
                rows={2}
              />
            )}
            <Field
              label={
                mode === "reply"
                  ? "What you want to say (Thai or rough Japanese)"
                  : "What you want to post (Thai or rough Japanese)"
              }
              placeholder={
                mode === "reply"
                  ? "อยากขอบคุณและบอกว่าดีใจมาก…"
                  : "วันนี้ไปกินเคเอฟซีมา / โพสต์รูปวาดใหม่…"
              }
              value={intent}
              onChange={setIntent}
              rows={2}
            />
            <Field
              label="Context — what you already posted / the situation (optional)"
              placeholder="โพสต์รูปวาดตัวละครนี้ไป…"
              value={posted}
              onChange={setPosted}
              rows={2}
            />
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <Button onClick={generate} disabled={busy || !hasInput}>
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {mode === "explain" ? "Explain" : "Get suggestions"}
        </Button>
        <CostHint model={MODEL_LABELS.engine} />
      </div>

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}

      {/* Result */}
      {result && (
        <div className="mt-6 space-y-3">
          {result.explanation && (
            <div className="rounded-2xl border border-border bg-surface p-4">
              <Markdown>{result.explanation}</Markdown>
            </div>
          )}

          {result.options.map((o, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, delay: i * 0.04 }}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-jp text-lg leading-relaxed">
                  <RubyText>{o.japanese}</RubyText>
                </p>
                <button
                  onClick={() => copy(plainJa(o.japanese), i)}
                  className="shrink-0 rounded-lg border border-border p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                  title="Copy Japanese"
                >
                  {copied === i ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              {o.thai && <p className="mt-1.5 text-sm">{o.thai}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                {o.register && (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5">
                    {o.register}
                  </span>
                )}
                {o.nuance && <span>{o.nuance}</span>}
              </div>

              <button
                onClick={() => toggleEditor(i, o.japanese)}
                className="mt-3 flex items-center gap-1 text-xs text-primary transition-colors hover:underline"
              >
                <Pencil className="h-3.5 w-3.5" />
                {editIdx === i ? "Close" : "Edit & check my version"}
              </button>

              {editIdx === i && (
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-1.5 text-xs text-muted">
                    Tweak it to your taste, then let Sensei check it.
                  </p>
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 font-jp text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Button
                      onClick={() => checkDraft(o.japanese)}
                      disabled={reviewBusy || !editText.trim()}
                    >
                      {reviewBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Check my version
                    </Button>
                    <CostHint model={MODEL_LABELS.engine} />
                  </div>

                  {reviewError && (
                    <p className="mt-2 text-sm text-accent">{reviewError}</p>
                  )}

                  {review && (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-primary">
                            {review.natural
                              ? "Natural ✨"
                              : "Sensei's version"}
                          </span>
                          <span className="text-xs text-muted">
                            {"★".repeat(review.rating)}
                            {"☆".repeat(Math.max(0, 5 - review.rating))}
                          </span>
                        </div>
                        <p className="font-jp text-base leading-relaxed">
                          <RubyText>{review.corrected}</RubyText>
                        </p>
                        <button
                          onClick={() => copy(plainJa(review.corrected), -1)}
                          className="mt-2 flex items-center gap-1 text-xs text-muted transition-colors hover:text-foreground"
                          title="Copy corrected Japanese"
                        >
                          {copied === -1 ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          Copy
                        </button>
                      </div>

                      {review.feedback && (
                        <div className="text-sm">
                          <Markdown>{review.feedback}</Markdown>
                        </div>
                      )}

                      {review.errors.length > 0 && (
                        <ul className="space-y-2">
                          {review.errors.map((err, k) => (
                            <li
                              key={k}
                              className="rounded-xl border border-border bg-surface-2 p-2.5 text-sm"
                            >
                              <div className="mb-1 flex items-center gap-2">
                                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent">
                                  {err.type}
                                </span>
                              </div>
                              <p className="font-jp">
                                <span className="text-accent line-through">
                                  {stripFurigana(furiganaToRuby(err.wrong))}
                                </span>
                                {" → "}
                                <span className="text-emerald-600">
                                  {stripFurigana(furiganaToRuby(err.right))}
                                </span>
                              </p>
                              {err.note && (
                                <p className="mt-0.5 text-xs text-muted">
                                  {err.note}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}

          {result.note &&
            (result.note.kanji || result.note.grammar) && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="mb-1 font-medium text-primary">ちょい学び</div>
                {result.note.kanji && (
                  <p className="font-jp">
                    <RubyText>{result.note.kanji}</RubyText>
                  </p>
                )}
                {result.note.grammar && (
                  <p className="mt-1 font-jp">
                    <RubyText>{result.note.grammar}</RubyText>
                  </p>
                )}
              </div>
            )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            <History className="h-4 w-4" />
            {showHistory ? "Hide" : "Recent"} ({history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5">
              {history.map((it) => (
                <button
                  key={it.id}
                  onClick={() => loadFromHistory(it)}
                  className="block w-full truncate rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  <span className="mr-1.5 rounded bg-surface-2 px-1.5 py-0.5">
                    {it.inputs.mode}
                  </span>
                  {it.inputs.intent ||
                    it.inputs.incoming ||
                    it.inputs.posted ||
                    "—"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <AskSensei
        context={{
          kind: "sns",
          mode,
          situation: situation || null,
          draft: intent || null,
        }}
        contextKey={`sns-${mode}-${history.length}`}
        suggestions={[
          "Make it shorter and more casual.",
          "Is this too formal for X?",
          "Suggest a friendlier way to say this.",
        ]}
      />
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}
