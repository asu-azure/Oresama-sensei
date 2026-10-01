// The REVIEW badge in the site header: cards left in TODAY's plan (never the
// lifetime pile — see the budget notes in review-queue.ts).
//
// The review page knows the number exactly and publishes it; other pages show
// the cached value at once and refresh it in the background when it is old.

import { sb, requireUser } from "./supabase";
import { getStudyPace } from "./pace";
import { getTodayLoad } from "./review-queue";
import { studyDayKey } from "./study-day";

const KEY = "oresama:due";
const EVT = "oresama:due";
const FRESH_MS = 3 * 60_000;

type Cached = { n: number; day: string; at: number };

function read(): Cached | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    return v && typeof v.n === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Publish today's remaining count (the review page calls this). */
export function setDue(n: number, day: string) {
  const v: Cached = { n: Math.max(0, n), day, at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
  window.dispatchEvent(new CustomEvent(EVT, { detail: v.n }));
}

/** One card graded: one unit of today's budget spent. */
export function bumpDue(delta: number) {
  const c = read();
  if (c) setDue(c.n + delta, c.day);
}

export function onDue(cb: (n: number) => void): () => void {
  const h = (e: Event) => cb((e as CustomEvent<number>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

/** Cached value now (or null), then a fresh one if the cache is old. */
export async function loadDue(cb: (n: number) => void) {
  const c = read();
  if (c) cb(c.n);
  if (c && Date.now() - c.at < FRESH_MS) return;
  try {
    const user = await requireUser();
    const pace = await getStudyPace(sb(), user.id);
    const now = new Date();
    const load = await getTodayLoad(sb(), user.id, pace, now);
    setDue(load.plannedToday.total, studyDayKey(now, pace.timeZone, pace.dayStartHour));
  } catch {
    // Offline or signed out: keep whatever is showing.
  }
}
