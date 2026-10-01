import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_DAY_START_HOUR,
  DEFAULT_STUDY_TIMEZONE,
  resolveDayStartHour,
  resolveTimeZone,
} from "./study-day";

/** How much study work to serve per day, and when a day rolls over. */
export interface StudyPace {
  newLimit: number;
  reviewLimit: number;
  timeZone: string;
  dayStartHour: number;
}

export const DEFAULT_PACE: StudyPace = {
  newLimit: 15,
  reviewLimit: 80,
  timeZone: DEFAULT_STUDY_TIMEZONE,
  dayStartHour: DEFAULT_DAY_START_HOUR,
};

export const NEW_LIMIT_MAX = 100;
export const REVIEW_LIMIT_MAX = 500;

export function clampNewLimit(v: unknown): number {
  return clampInt(v, DEFAULT_PACE.newLimit, 0, NEW_LIMIT_MAX);
}
export function clampReviewLimit(v: unknown): number {
  return clampInt(v, DEFAULT_PACE.reviewLimit, 0, REVIEW_LIMIT_MAX);
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : v;
  if (typeof n !== "number" || !Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

let cached: Promise<StudyPace> | null = null;

/** The learner's study pace from `profiles`, read once per page. Any failure
 *  falls back to the defaults, which are exactly what the columns default to. */
export function getStudyPace(supabase: SupabaseClient, userId: string): Promise<StudyPace> {
  cached ??= (async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("daily_new_limit,daily_review_limit,study_timezone,day_start_hour")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return DEFAULT_PACE;
      return {
        newLimit: clampNewLimit(data.daily_new_limit),
        reviewLimit: clampReviewLimit(data.daily_review_limit),
        timeZone: resolveTimeZone(data.study_timezone as string | null),
        dayStartHour: resolveDayStartHour(data.day_start_hour as number | null),
      };
    } catch {
      return DEFAULT_PACE;
    }
  })();
  return cached;
}

/** Forget the cached pace (after Settings saves a new one). */
export function resetStudyPace() {
  cached = null;
}
