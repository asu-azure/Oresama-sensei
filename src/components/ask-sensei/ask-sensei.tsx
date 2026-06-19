"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, MessageCircle } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { cn } from "@/lib/utils";
import type { AskContext, DiscussMessage } from "@/lib/types";

const DEFAULT_SUGGESTIONS = [
  "Can you explain this more?",
  "Give me another example.",
  "How is this used in real life?",
];

/**
 * Floating, context-aware "Ask Sensei" helper. A corner bubble opens a chat
 * panel that knows what the learner is currently looking at (an exercise, a
 * saved word, a kanji, or a lesson). On mobile it's a bottom sheet whose close
 * button is inside the sheet — never trapped under the top nav.
 *
 * `contextKey` identifies the current item; when it changes the conversation
 * resets (via remount) so asking about a new card starts fresh.
 */
export function AskSensei({
  context,
  contextKey,
  suggestions,
}: {
  context: AskContext;
  contextKey?: string;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <AskPanel
            key={contextKey ?? "static"}
            context={context}
            suggestions={suggestions}
            onClose={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setOpen(true)}
          aria-label="Ask Sensei"
          className="fixed right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Ask Sensei</span>
        </motion.button>
      )}
    </>
  );
}

function AskPanel({
  context,
  suggestions,
  onClose,
}: {
  context: AskContext;
  suggestions?: string[];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<DiscussMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");

    const withUser: DiscussMessage[] = [...messages, { role: "user", content }];
    setMessages([...withUser, { role: "assistant", content: "" }]);
    setLoading(true);

    let accumulated = "";
    try {
      const res = await fetch("/api/tests/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, messages: withUser }),
      });
      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...withUser, { role: "assistant", content: accumulated }]);
      }
    } catch {
      setMessages(withUser);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const tips = suggestions ?? DEFAULT_SUGGESTIONS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: "spring", stiffness: 360, damping: 32 }}
      className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[400px] sm:max-h-[70vh] sm:rounded-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header — X lives here, always reachable */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Ask Sensei</span>
        <CostHint model={MODEL_LABELS.engine} className="ml-2" />
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 transition-colors hover:bg-surface-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Ask anything about what you&apos;re looking at — nuance, usage, why
              an answer is right, or more examples.
            </p>
            <div className="space-y-1">
              {tips.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "text-sm",
              m.role === "user"
                ? "ml-6 rounded-2xl rounded-tr-sm bg-primary/10 px-3 py-2 text-right"
                : "mr-6",
            )}
          >
            {m.role === "user" ? (
              <span className="font-jp">{m.content}</span>
            ) : (
              <div className="font-jp">
                {m.content ? (
                  <Markdown>{m.content}</Markdown>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask a question… (Enter to send)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted disabled:opacity-50"
            style={{ maxHeight: "6rem" }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
