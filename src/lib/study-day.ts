// The "study day" — when today's review budget resets.
//
// The app previously had no notion of a day at all: `srs_due <= now()` was
// evaluated against a bare UTC wall clock. A daily budget needs a boundary, and
// it must be a LOCAL one with a small-hours rollover, so that a session running
// past midnight still counts as the same day's work.
//
// Pure and isomorphic (no ts-fsrs, no supabase, no `server-only`) so the client
// can compute the same day key the server did.
//
// Limits, stated plainly:
//   - Relies on the runtime's ICU timezone data. An unknown zone falls back to
//     the default via `resolveTimeZone`.
//   - Ambiguous local times (autumn fall-back — the hour happens twice) resolve
//     to the FIRST occurrence; nonexistent ones (spring-forward skips the hour)
//     resolve an hour later, and the `start <= now` guard keeps the boundary
//     monotone. Both are once-a-year, one-hour effects in DST zones.
//   - None of this applies to the default Asia/Bangkok (UTC+7, no DST), which is
//     part of why a 4am default is safe: DST transitions happen at 2-3am.

export const DEFAULT_STUDY_TIMEZONE = "Asia/Bangkok";
export const DEFAULT_DAY_START_HOUR = 4;

const DAY_MS = 86_400_000;

interface Wall {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const FMT_CACHE = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = FMT_CACHE.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      // h23, not hour12:false — the latter can render midnight as "24".
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    FMT_CACHE.set(timeZone, f);
  }
  return f;
}

/** The wall-clock reading in `timeZone` at instant `at`. */
function wallParts(at: Date, timeZone: string): Wall {
  const parts = formatterFor(timeZone).formatToParts(at);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Milliseconds to ADD to a UTC instant to get the zone's wall clock. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const w = wallParts(at, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Second granularity: drop sub-second so the diff is a clean offset.
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** A local wall-clock date+hour in `timeZone` → the UTC instant it names.
 *  Two-pass: guess with the offset at the guessed instant, then re-check, which
 *  is enough for every real IANA zone (offsets shift by at most a couple of
 *  hours and never twice inside one calculation). */
function zonedToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  const o1 = zoneOffsetMs(new Date(guess), timeZone);
  const t1 = guess - o1;
  const o2 = zoneOffsetMs(new Date(t1), timeZone);
  return new Date(o2 === o1 ? t1 : guess - o2);
}

/** Accept a stored timezone, falling back to the default if the runtime doesn't
 *  know it (a typo would otherwise throw on every page render). */
export function resolveTimeZone(v?: string | null): string {
  if (!v) return DEFAULT_STUDY_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return DEFAULT_STUDY_TIMEZONE;
  }
}

/** Clamp a stored rollover hour into 0-23. */
export function resolveDayStartHour(v?: number | string | null): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_DAY_START_HOUR;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

/** The instant the current study day began. */
export function startOfStudyDay(
  now: Date,
  timeZone: string,
  dayStartHour: number,
): Date {
  const w = wallParts(now, timeZone);
  let { year, month, day } = w;
  if (w.hour < dayStartHour) {
    // Still in the tail of yesterday's study day. Step back one calendar day
    // using a UTC-anchored DATE (never a wall-clock instant), so DST can't bite.
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    year = d.getUTCFullYear();
    month = d.getUTCMonth() + 1;
    day = d.getUTCDate();
  }
  let start = zonedToInstant(year, month, day, dayStartHour, timeZone);
  // Safety net for a DST-skipped start hour: the boundary is never in the future.
  if (start.getTime() > now.getTime()) start = new Date(start.getTime() - DAY_MS);
  return start;
}

/** `YYYY-MM-DD` identifying the study day `now` falls in. */
export function studyDayKey(
  now: Date,
  timeZone: string,
  dayStartHour: number,
): string {
  const start = startOfStudyDay(now, timeZone, dayStartHour);
  const w = wallParts(start, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

/** When the budget next resets (for "resets at 4:00" copy). */
export function nextStudyDayStart(
  now: Date,
  timeZone: string,
  dayStartHour: number,
): Date {
  const start = startOfStudyDay(now, timeZone, dayStartHour);
  const w = wallParts(start, timeZone);
  const d = new Date(Date.UTC(w.year, w.month - 1, w.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return zonedToInstant(
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    dayStartHour,
    timeZone,
  );
}

/** `YYYY-MM-DD` for `at` in `timeZone` (plain calendar day, no rollover). Use
 *  for chart bucketing, which previously keyed on UTC and so mislabelled
 *  anything studied before 07:00 in Bangkok as the previous day. */
export function calendarDayKey(at: Date, timeZone: string): string {
  const w = wallParts(at, timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}
