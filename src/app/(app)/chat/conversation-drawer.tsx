"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, Plus, MessageSquare, Pencil, Trash2, Check } from "lucide-react";
import { deleteConversation, renameConversation } from "./actions";
import { cn } from "@/lib/utils";

export type ConversationSummary = {
  id: string;
  title: string | null;
  created_at: string;
};

function groupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return "This week";
  return "Earlier";
}

const ORDER = ["Today", "Yesterday", "This week", "Earlier"];

export function ConversationDrawer({
  conversations,
  activeId,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const groups = new Map<string, ConversationSummary[]>();
  for (const c of conversations) {
    const g = groupLabel(c.created_at);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(c);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Past conversations"
        aria-label="Past conversations"
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95"
      >
        <Menu className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] flex-col border-r border-border bg-surface"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="text-sm font-semibold">Conversations</span>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-3">
                <Link
                  href="/chat"
                  onClick={close}
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
                >
                  <Plus className="h-4 w-4" /> New chat
                </Link>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 pb-4">
                {conversations.length === 0 && (
                  <p className="px-1 py-6 text-center text-sm text-muted">
                    No past conversations yet.
                  </p>
                )}
                {ORDER.filter((g) => groups.has(g)).map((g) => (
                  <div key={g} className="mb-4">
                    <p className="mb-1 px-1 text-xs font-medium uppercase tracking-wide text-muted">
                      {g}
                    </p>
                    <ul className="space-y-0.5">
                      {groups.get(g)!.map((c) => (
                        <li key={c.id}>
                          <ConversationRow
                            c={c}
                            active={c.id === activeId}
                            onNavigate={close}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function ConversationRow({
  c,
  active,
  onNavigate,
}: {
  c: ConversationSummary;
  active: boolean;
  onNavigate: () => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <form
        action={renameConversation}
        onSubmit={() => setEditing(false)}
        className="flex items-center gap-1 py-1"
      >
        <input type="hidden" name="conversationId" value={c.id} />
        <input
          name="title"
          defaultValue={c.title ?? ""}
          autoFocus
          maxLength={80}
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          title="Save"
          className="rounded-md p-1 text-primary hover:bg-surface-2"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          title="Cancel"
          className="rounded-md p-1 text-muted hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-0.5 rounded-lg pr-1 transition-colors",
        active ? "bg-surface-2" : "hover:bg-surface-2",
      )}
    >
      <Link
        href={`/chat?c=${c.id}`}
        onClick={onNavigate}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-sm",
          active ? "text-foreground" : "text-muted",
        )}
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="truncate">{c.title || "Untitled chat"}</span>
      </Link>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Rename"
        aria-label="Rename conversation"
        className="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-background hover:text-foreground focus:opacity-100 group-hover:opacity-100"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <form
        action={deleteConversation}
        onSubmit={(e) => {
          if (!confirm("Delete this conversation? This can't be undone.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="conversationId" value={c.id} />
        <button
          type="submit"
          title="Delete"
          aria-label="Delete conversation"
          className="rounded-md p-1 text-muted opacity-0 transition-opacity hover:bg-background hover:text-accent focus:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}