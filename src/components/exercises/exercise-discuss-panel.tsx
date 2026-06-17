"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, Send, Loader2, MessageCircle } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { cn } from "@/lib/utils";
import type { DiscussMessage, Exercise } from "@/lib/types";

export function ExerciseDiscussPanel({
  exercise,
  messages,
  onMessages,
  onClose,
}: {
  exercise: Exercise;
  messages: DiscussMessage[];
  onMessages: (msgs: DiscussMessage[]) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    setInput("");

    const userMsg: DiscussMessage = { role: "user", content };
    const withUser = [...messages, userMsg];
    onMessages([...withUser, { role: "assistant", content: "" }]);
    setLoading(true);

    let accumulated = "";
    try {
      const res = await fetch("/api/tests/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise, messages: withUser }),
      });
      if (!res.ok || !res.body) throw new Error("Failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        onMessages([...withUser, { role: "assistant", content: accumulated }]);
      }
    } catch {
      onMessages(withUser);
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

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-background shadow-2xl sm:w-[400px]"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <MessageCircle className="h-4 w-4 text-primary" />
        <span className="flex-1 text-sm font-medium">Ask about this question</span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 transition-colors hover:bg-surface-2"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">Ask anything about this exercise — why an answer is right, whether the question looks wrong, or deeper context.</p>
            <div className="space-y-1">
              {SUGGESTIONS.map((s) => (
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
            ref={textareaRef}
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
        <p className="mt-1.5 text-center text-[10px] text-muted">
          Shift+Enter for new line
        </p>
      </div>
    </motion.div>
  );
}

const SUGGESTIONS = [
  "Why is this answer correct?",
  "I think the answer should be different — why not?",
  "Can you explain this grammar point more?",
];
