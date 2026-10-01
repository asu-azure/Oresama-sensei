import { describe, expect, it } from "vitest";
import {
  startOfStudyDay,
  studyDayKey,
  nextStudyDayStart,
  calendarDayKey,
  resolveTimeZone,
  resolveDayStartHour,
} from "./study-day";

const BKK = "Asia/Bangkok"; // UTC+7, no DST

describe("study day (Asia/Bangkok, 4am rollover)", () => {
  it("starts at 04:00 local on the same calendar day after 4am", () => {
    const now = new Date("2026-10-01T10:00:00+07:00");
    expect(startOfStudyDay(now, BKK, 4).toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(studyDayKey(now, BKK, 4)).toBe("2026-10-01");
  });

  it("still counts 03:59 as the previous day", () => {
    const now = new Date("2026-10-02T03:59:00+07:00");
    expect(studyDayKey(now, BKK, 4)).toBe("2026-10-01");
    expect(startOfStudyDay(now, BKK, 4).toISOString()).toBe("2026-09-30T21:00:00.000Z");
  });

  it("rolls over exactly at 04:00", () => {
    expect(studyDayKey(new Date("2026-10-02T04:00:00+07:00"), BKK, 4)).toBe("2026-10-02");
  });

  it("knows when the budget next resets", () => {
    const now = new Date("2026-10-01T23:30:00+07:00");
    expect(nextStudyDayStart(now, BKK, 4).toISOString()).toBe("2026-10-01T21:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    expect(studyDayKey(new Date("2026-11-01T02:00:00+07:00"), BKK, 4)).toBe("2026-10-31");
  });

  it("buckets chart days by local calendar day, not UTC", () => {
    // 06:30 in Bangkok is still the previous day in UTC.
    expect(calendarDayKey(new Date("2026-10-01T06:30:00+07:00"), BKK)).toBe("2026-10-01");
  });
});

describe("zones with DST", () => {
  it("never puts the start of the day in the future", () => {
    const ny = "America/New_York";
    // Around the November fall-back and the March spring-forward.
    for (const iso of ["2026-11-01T01:30:00-04:00", "2026-11-01T05:00:00-05:00", "2026-03-08T03:30:00-04:00"]) {
      const now = new Date(iso);
      expect(startOfStudyDay(now, ny, 4).getTime()).toBeLessThanOrEqual(now.getTime());
      expect(nextStudyDayStart(now, ny, 4).getTime()).toBeGreaterThan(now.getTime());
    }
  });
});

describe("stored settings are clamped", () => {
  it("falls back on an unknown zone", () => {
    expect(resolveTimeZone("Mars/Olympus_Mons")).toBe("Asia/Bangkok");
    expect(resolveTimeZone(null)).toBe("Asia/Bangkok");
    expect(resolveTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
  });

  it("keeps the rollover hour in 0–23", () => {
    expect(resolveDayStartHour(30)).toBe(23);
    expect(resolveDayStartHour(-2)).toBe(0);
    expect(resolveDayStartHour("6")).toBe(6);
    expect(resolveDayStartHour("x")).toBe(4);
  });
});
