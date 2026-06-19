import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friendly labels for the models we call, so cost hints stay consistent. */
export const MODEL_LABELS = {
  sonnet: "Claude Sonnet",
  opus: "Claude Opus",
  haiku: "Claude Haiku",
  geminiFlash: "Gemini Flash",
  geminiPro: "Gemini Pro",
  /** Calls whose model follows the global "AI engine" Settings toggle. */
  engine: "AI engine",
} as const;

/** Map the lesson-writer choice to a display label. */
export function lessonModelLabel(
  m: "claude" | "opus" | "gemini" | "gemini-pro",
): string {
  return m === "opus"
    ? MODEL_LABELS.opus
    : m === "gemini"
      ? MODEL_LABELS.geminiFlash
      : m === "gemini-pro"
        ? MODEL_LABELS.geminiPro
        : MODEL_LABELS.sonnet;
}

/**
 * A tiny, unobtrusive marker shown next to any action that spends API tokens.
 * The coin icon signals "this costs money", and the label says which model runs.
 * Hover for a fuller explanation.
 */
export function CostHint({
  model,
  className,
  note,
}: {
  model: string;
  className?: string;
  /** Extra context appended to the tooltip (e.g. "free to replay"). */
  note?: string;
}) {
  return (
    <span
      title={`Runs an AI request (${model})${note ? ` — ${note}` : ""}. This uses API tokens (costs money).`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] leading-none text-muted",
        className,
      )}
    >
      <Coins className="h-3 w-3 shrink-0" aria-hidden />
      <span>{model}</span>
    </span>
  );
}
