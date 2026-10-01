import { describe, expect, it } from "vitest";
import { interleave, overdueRatio } from "./review-queue";

const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`);

describe("interleave", () => {
  it("keeps every card, each side in its own order", () => {
    const r = ids("r", 80);
    const n = ids("n", 15);
    const out = interleave(r, n);
    expect(out).toHaveLength(95);
    expect(out.filter((x) => x.startsWith("r"))).toEqual(r);
    expect(out.filter((x) => x.startsWith("n"))).toEqual(n);
  });

  it("warms up on a review and spreads new words evenly", () => {
    const out = interleave(ids("r", 80), ids("n", 15));
    expect(out[0].startsWith("r")).toBe(true);
    const positions = out.flatMap((x, i) => (x.startsWith("n") ? [i] : []));
    const gaps = positions.slice(1).map((p, i) => p - positions[i]);
    // ~95/15 ≈ 6 apart, never bunched up and never far apart.
    for (const g of gaps) {
      expect(g).toBeGreaterThanOrEqual(5);
      expect(g).toBeLessThanOrEqual(8);
    }
  });

  it("degrades to one side when the other is empty", () => {
    expect(interleave([], ["a", "b"])).toEqual(["a", "b"]);
    expect(interleave(["a", "b"], [])).toEqual(["a", "b"]);
    expect(interleave([], [])).toEqual([]);
  });

  it("handles more new words than reviews", () => {
    const out = interleave(["r0"], ids("n", 4));
    expect(out).toHaveLength(5);
    expect(out.filter((x) => x === "r0")).toHaveLength(1);
  });
});

describe("overdueRatio", () => {
  const DAY = 86_400_000;
  const now = Date.parse("2026-10-01T12:00:00Z");
  const due = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

  it("ranks a short-interval card above a long one equally late", () => {
    const short = overdueRatio({ srs_due: due(3), srs_interval: 1 }, now);
    const long = overdueRatio({ srs_due: due(3), srs_interval: 200 }, now);
    expect(short).toBeGreaterThan(long);
  });

  it("puts never-scheduled cards first", () => {
    expect(overdueRatio({ srs_due: null, srs_interval: null }, now)).toBe(Number.POSITIVE_INFINITY);
  });

  it("floors the window at one day", () => {
    expect(overdueRatio({ srs_due: due(2), srs_interval: 0 }, now)).toBeCloseTo(2);
  });
});
