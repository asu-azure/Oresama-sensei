"use client";

import { useSyncExternalStore } from "react";

// Live "cards due for review" count, shared across the app so the Review nav
// badge updates the instant you grade a card (no page refresh). Backed by a
// module variable (not localStorage — it's per-session live state, re-seeded from
// the server on each navigation). useSyncExternalStore → lint-clean, no effects.

let dueCount: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): number | null {
  return dueCount;
}

export function useReviewDue(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** Set the authoritative due count (seeded from the server each navigation). */
export function setReviewDue(n: number): void {
  const next = Math.max(0, Math.floor(n));
  if (next === dueCount) return;
  dueCount = next;
  emit();
}

/** Nudge the count (e.g. -1 when a graded card leaves the due set). No-op until
 *  it's been seeded, so we never invent a number out of nothing. */
export function bumpReviewDue(delta: number): void {
  if (dueCount === null) return;
  const next = Math.max(0, dueCount + delta);
  if (next === dueCount) return;
  dueCount = next;
  emit();
}
