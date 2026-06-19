"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { RubyText } from "@/components/ruby-text";
import { CostHint, MODEL_LABELS } from "@/components/cost-hint";
import { cn } from "@/lib/utils";
import { getOrGenerateExplanation } from "@/app/(app)/library/actions";
import type { DeepDiveExample } from "@/lib/claude";

/** "Explain more" expander for a saved item: lazy-loads a richer AI explanation
 *  + extra examples on first tap (cached server-side), without leaving the page. */
export function DeepDiveSection({
  itemId,
  initialExplanation = null,
  initialExamples = [],
}: {
  itemId: string;
  /** Server-prefetched cached explanation, shown immediately (no fetch). */
  initialExplanation?: string | null;
  initialExamples?: DeepDiveExample[];
}) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(!!initialExplanation);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(
    initialExplanation,
  );
  const [examples, setExamples] = useState<DeepDiveExample[]>(initialExamples);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    if (loading) return;
    if (explanation && !force) {
      setOpen((o) => !o);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await getOrGenerateExplanation(itemId, force);
    if ("error" in res) setError(res.error);
    else {
      setExplanation(res.explanation_md);
      setExamples(res.examples ?? []);
      setOpen(true);
    }
    setLoading(false);
  }

  return (
    <div className="mt-2.5 border-t border-border/60 pt-2.5">
      <button
        onClick={() => load(false)}
        disabled={loading}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {explanation ? "Explanation" : "Explain more"}
        {explanation ? (
          <ChevronDown
            className={cn(
              "ml-auto h-3.5 w-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        ) : (
          <CostHint model={MODEL_LABELS.sonnet} className="ml-auto" />
        )}
      </button>
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      <AnimatePresence initial={false}>
        {open && explanation && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-2 text-sm">
              <Markdown>{explanation}</Markdown>
            </div>
            {examples.length > 0 && (
              <div className="mt-2 border-t border-border/60 pt-2">
                <p className="mb-1 text-xs font-medium text-muted">
                  More examples
                </p>
                <ul className="space-y-1.5">
                  {examples.map((ex, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-jp">
                        <RubyText>{ex.ja}</RubyText>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {ex.en}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => load(true)}
                disabled={loading}
                className="text-xs text-muted underline transition-colors hover:text-foreground disabled:opacity-50"
              >
                Regenerate
              </button>
              <CostHint model={MODEL_LABELS.sonnet} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
