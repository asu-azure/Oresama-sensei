import { cache } from "react";
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

/** Read the learner's study pace from `profiles`.
 *
 *  Degrades gracefully if migration 0024 hasn't been run: PostgREST answers an
 *  unknown column with an error rather than throwing, so any failure falls back
 *  to DEFAULT_PACE (which is exactly what the migration defaults to). Wrapped in
 *  React `cache` so the (app) layout and the page it renders share one read per
 *  request instead of two. */
export const getStudyPace = cache(
  async (supabase: SupabaseClient, userId: string): Promise<StudyPace> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "daily_new_limit,daily_review_limit,study_timezone,day_start_hour",
        )
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return DEFAULT_PACE;
      const p = data as Record<string, unknown>;
      return {
        newLimit: clampNewLimit(p.daily_new_limit),
        reviewLimit: clampReviewLimit(p.daily_review_limit),
        timeZone: resolveTimeZone(p.study_timezone as string | null),
        dayStartHour: resolveDayStartHour(p.day_start_hour as number | null),
      };
    } catch {
      return DEFAULT_PACE;
    }
  },
);
