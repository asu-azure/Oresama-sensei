"use client";

import { useSyncExternalStore } from "react";
import type { IntervalPreview } from "@/lib/srs";
import type { ReviewCard, CardMeta } from "./review-client";

// Persist the in-progress flashcard session (the batch + where you are in it) so
// leaving /review — opening the source lesson, switching apps, an accidental
// back — and returning resumes the SAME cards at the SAME spot instead of
// restarting from item 1. sessionStorage (per-tab) fits "leave and come back";
// it clears when the tab closes. No effects (useSyncExternalStore) → lint-clean
// and hydration-safe (server snapshot = null, client updates after hydration).

export type ReviewSession = {
  savedAt: number;
  mode: "due" | "ahead";
  cards: ReviewCard[];
  previews: Record<string, IntervalPreview>;
  meta: Record<string, CardMeta>;
  index: number;
  reviewed: number;
  totalDue: number;
};

const KEY = "review-session";
const EVT = "review-session-change";
/** Ignore a resumed session older than this (a stale tab from yesterday). */
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

// useSyncExternalStore requires getSnapshot to return a STABLE reference when
// nothing changed, so cache the parsed object keyed by the raw string.
let cacheRaw: string | null = null;
let cacheVal: ReviewSession | null = null;

function read(): ReviewSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  try {
    cacheVal = raw ? (JSON.parse(raw) as ReviewSession) : null;
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
