// Shared types + pure math for the per-item "sawtooth" (recall over time). No
// server-only deps here (no ts-fsrs), so the client chart can import it freely.
// The decay between reviews uses R(t) = 0.9 ^ (t/S): recall falls to ~90% after
// `stability` days — a faithful stand-in for FSRS's curve that avoids pulling
// the server-only scheduler into the browser.

/** One row of the review_log table (migration 0022). */
export interface ReviewLogRow {
  reviewed_at: string;
  rating: string;
  elapsed_days: number | null;
  retrievability: number | null; // 0..1, recall just BEFORE this review
  stability_before: number | null;
  stability_after: number;
  interval_after: number | null;
}

export interface SawtoothPoint {
  t: number; // epoch ms
  r: number; // recall 0..1
}

export interface SawtoothReview {
  t: number; // epoch ms (the upward jump)
  rating: string;
}

export interface Sawtooth {
  curve: SawtoothPoint[];
  reviews: SawtoothReview[];
  t0: number;
  t1: number;
}

const DAY_MS = 86_400_000;
const SAMPLES = 14; // points sampled across each decay segment

/** Reconstruct the recall-over-time curve from a chronological review log. Each
 *  review snaps recall to 1.0, then it decays with that review's resulting
 *  stability until the next review (or `now` for the final, open segment). */
export function buildSawtooth(
  rows: ReviewLogRow[],
  now: Date = new Date(),
): Sawtooth | null {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort(
    (a, b) =>
      new Date(a.reviewed_at).getTime() - new Date(b.reviewed_at).getTime(),
  );
  const times = sorted.map((r) => new Date(r.reviewed_at).getTime());
  const nowMs = now.getTime();
  const t0 = times[0];
  const t1 = Math.max(nowMs, times[times.length - 1] + DAY_MS);

  const decay = (dtDays: number, S: number) =>
    Math.pow(0.9, dtDays / Math.max(0.1, S));

  const curve: SawtoothPoint[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = times[i];
    const end = i + 1 < sorted.length ? times[i + 1] : t1;
    const S = sorted[i].stability_after || 1;
    curve.push({ t: start, r: 1 }); // the jump back up
    const span = end - start;
    if (span <= 0) continue;
    for (let s = 1; s <= SAMPLES; s++) {
      const t = start + (span * s) / SAMPLES;
      curve.push({ t, r: decay((t - start) / DAY_MS, S) });
    }
  }

  return {
    curve,
    reviews: sorted.map((r, i) => ({ t: times[i], rating: r.rating })),
    t0,
    t1,
  };
}
