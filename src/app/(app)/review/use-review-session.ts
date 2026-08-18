"use client";

import { useSyncExternalStore } from "react";
import type { IntervalPreview } from "@/lib/srs";
import type { ReviewCard, CardMeta, QueueSummary } from "./review-client";

// Persist the in-progress flashcard session (the batch + where you are in it) so
// leaving /review — opening the source lesson, switching apps, an accidental
// back — and returning resumes the SAME cards at the SAME spot instead of
// restarting from item 1. sessionStorage (per-tab) fits "leave and come back";
// it clears when the tab closes. No effects (useSyncExternalStore) → lint-clean
// and hydration-safe (server snapshot = null, client updates after hydration).

/** What a saved session must look like to be resumable. */
export type ReviewSession = {
  savedAt: number;
  mode: "due" | "ahead";
  cards: ReviewCard[];
  previews: Record<string, IntervalPreview>;
  meta: Record<string, CardMeta>;
  index: number;
  reviewed: number;
  totalDue: number;
  /** Today's plan as computed by lib/review-queue (see review-client). */
  summary?: QueueSummary;
  /** Which study day this batch belongs to (see lib/study-day). A session from
   *  before the rollover must not be replayed against the new day's budget. */
  dayKey?: string;
};

// Versioned: the shape changed when the daily budget landed, and a payload
// written by the previous build would crash on resume. Bumping the key means
// old payloads are simply never found; `LEGACY_KEYS` are swept once so they
// don't sit in storage forever.
const KEY = "review-session-v2";
const LEGACY_KEYS = ["review-session"];
const EVT = "review-session-change";
/** Ignore a resumed session older than this (a stale tab from yesterday). */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

// useSyncExternalStore requires getSnapshot to return a STABLE reference when
// nothing changed, so cache the parsed object keyed by the raw string.
let cacheRaw: string | null = null;
let cacheVal: ReviewSession | null = null;
let sweptLegacy = false;

/** Structural check. Anything that doesn't match is dropped rather than handed
 *  to the UI — so a future shape change degrades to "start a fresh batch"
 *  instead of throwing on the first property access. */
function isSession(v: unknown): v is ReviewSession {
  if (!v || typeof v !== "object") return false;
  const s = v as Partial<ReviewSession>;
  return (
    typeof s.savedAt === "number" &&
    (s.mode === "due" || s.mode === "ahead") &&
    Array.isArray(s.cards) &&
    typeof s.index === "number" &&
    typeof s.reviewed === "number" &&
    typeof s.totalDue === "number" &&
    !!s.previews &&
    !!s.meta
  );
}

function read(): ReviewSession | null {
  if (typeof window === "undefined") return null;
  if (!sweptLegacy) {
    sweptLegacy = true;
    for (const k of LEGACY_KEYS) window.sessionStorage.removeItem(k);
  }
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cacheVal = isSession(parsed) ? parsed : null;
  } catch {
    cacheVal = null;
  }
  return cacheVal;
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

export function useReviewSession(): ReviewSession | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Is this saved session still safe to resume? Fresh enough, and from the same
 *  study day — otherwise it would replay yesterday's cards (with stale FSRS
 *  interval previews) against today's budget. */
export function isResumable(
  s: ReviewSession | null,
  dayKey?: string,
  now: number = Date.now(),
): s is ReviewSession {
  if (!s) return false;
  if (now - s.savedAt > SESSION_TTL_MS) return false;
  if (dayKey && s.dayKey && s.dayKey !== dayKey) return false;
  return true;
}

export function saveReviewSession(s: ReviewSession): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVT));
}

export function clearReviewSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVT));
}
