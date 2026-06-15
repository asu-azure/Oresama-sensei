"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Plus, Loader2, Sparkles } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What's the nuance between ～によって and ～により?",
  "Teach me 3 N1 expressions I can use when chatting with artists on X.",
  "Explain the grammar 〜ともなると with examples.",
];

export function ChatClient({
  initialConversationId,
  initialMessages,
}: {
  initialConversationId: string | null;
  initialMessages: UiMessage[];
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);
    setInput("");

    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: content }),
      });
      if (!res.ok || !res.body) {
        throw new Error(
          res.status === 401 ? "Your session expired. Please sign in again." : "Something went wrong.",
        );
      }
      const cid = res.headers.get("x-conversation-id");
      if (cid) setConversationId(cid);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? { ...msg, content: msg.content + chunk }
              : msg,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setMessages((m) => m.filter((msg) => msg.id !== assistantId));
    } finally {
      setBusy(false);
    }
  }

  function newChat() {
    if (busy) return;
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex items-center justify-between py-3">
        <h1 className="text-sm font-medium text-muted">
          {messages.length > 0 ? "Conversation" : "Ask anything"}
        </h1>
        <Button variant="outline" size="sm" onClick={newChat} disabled={busy}>
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto pb-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="font-jp text-xl font-semibold">先生にきいてみよう</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Ask about grammar, vocabulary, or usage. Everything you learn is
              remembered and used to personalize future answers.
            </p>
            <div className="mt-6 flex w-full max-w-md flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm transition-colors hover:bg-surface-2"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface",
                )}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <Markdown>{m.content}</Markdown>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted" />
                  )
                ) : (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && <p className="pb-2 text-center text-sm text-accent">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border bg-background py-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="日本語について何でも聞いてください…"
            rows={1}
            className="max-h-40 flex-1 resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            className="h-12 w-12 rounded-xl"
          >
            {busy ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
