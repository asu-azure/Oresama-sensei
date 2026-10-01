// The in-progress flashcard batch, kept in sessionStorage so leaving the page —
// opening a kanji from the card, switching apps, an accidental back — and
// returning resumes the SAME cards at the SAME place instead of starting over.
// Per tab, gone when the tab closes.
//
// Cards are stored as rows (not rendered state): interval previews, strength
// and pictures are derived again on resume, so nothing stale is replayed.

import type { Item } from "./types";

export type QueueSummary = {
  /** Cards in today's plan — the number the learner is asked to finish. */
  plannedToday: number;
  backlogReviews: number;
  backlogNew: number;
  daysToClear: number;
  nextResetIso: string;
  /** This batch was asked for beyond the daily plan (?over=1). */
  overBudget: boolean;
};

export type ReviewSession = {
  v: 3;
  savedAt: number;
  mode: "due" | "ahead";
  dayKey: string;
  cards: Item[];
  index: number;
  reviewed: number;
  summary: QueueSummary;
};

// Versioned: a payload from an older build is simply never found.
const KEY = "review-session-v3";
const LEGACY = ["review-session", "review-session-v2"];
/** A batch older than this is a stale tab from earlier — start fresh. */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

function valid(v: unknown): v is ReviewSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<ReviewSession>;
  return (
    s.v === 3 &&
    typeof s.savedAt === "number" &&
    (s.mode === "due" || s.mode === "ahead") &&
    typeof s.dayKey === "string" &&
    Array.isArray(s.cards) &&
    typeof s.index === "number" &&
    typeof s.reviewed === "number" &&
    !!s.summary
  );
}

/** The saved batch, if it is still safe to resume: fresh, from this study day,
 *  asked for the same way (?over=1 or not), and not already finished. */
export function loadSession(dayKey: string, over: boolean, now = Date.now()): ReviewSession | null {
  try {
    for (const k of LEGACY) sessionStorage.removeItem(k);
    const s: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!valid(s)) return null;
    if (now - s.savedAt > SESSION_TTL_MS) return null;
    if (s.dayKey !== dayKey) return null;
    if (s.summary.overBudget !== over) return null;
    if (s.index >= s.cards.length) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: ReviewSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the batch just won't survive a reload.
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
