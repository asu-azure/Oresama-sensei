"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { conjugate } from "@/lib/conjugation";
import { cn } from "@/lib/utils";

/**
 * Compact, collapsible conjugation table for a verb/adjective flashcard. Renders
 * nothing when the item doesn't conjugate (computed offline, no AI cost).
 */
export function ConjugationTable({
  term,
  reading,
  pos,
  defaultOpen = false,
}: {
  term: string;
  reading?: string | null;
  pos?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const forms = conjugate(term, reading, pos);
  if (!forms || forms.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-2/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted"
        aria-expanded={open}
      >
        <span>Conjugation</span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border px-3 py-2.5">
          {forms.map((f) => (
            <div key={f.label} className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted">
                {f.label}
              </span>
              <span className="font-jp text-sm">{f.form}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
