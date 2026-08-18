"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clampNewLimit, clampReviewLimit } from "@/lib/study-pace";
import { resolveDayStartHour, resolveTimeZone } from "@/lib/study-day";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const str = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v.length > 0 ? v : null;
  };

  const base = {
    id: user.id,
    display_name: str("display_name"),
    interests: str("interests"),
    jlpt_target: str("jlpt_target") ?? "N2",
    native_language: str("native_language") ?? "Thai",
    tone: str("tone"),
    updated_at: new Date().toISOString(),
  };
  const ai_engine = str("ai_engine") === "claude" ? "claude" : "gemini";

  const pace = {
    daily_new_limit: clampNewLimit(formData.get("daily_new_limit")),
    daily_review_limit: clampReviewLimit(formData.get("daily_review_limit")),
    study_timezone: resolveTimeZone(str("study_timezone")),
    day_start_hour: resolveDayStartHour(str("day_start_hour")),
  };

  // Widest payload first; each fallback drops the newest migration's columns
  // (0024 pace → 0015 ai_engine → base). An upsert only writes the columns it
  // names, so chat_model (0018) is never clobbered by any of these.
  for (const payload of [
    { ...base, ai_engine, ...pace },
    { ...base, ai_engine },
    base,
  ]) {
    const { error } = await supabase.from("profiles").upsert(payload);
    if (!error) break;
  }

  revalidatePath("/settings");
  // The nav badge is computed in the (app) layout from these limits.
  revalidatePath("/", "layout");
}
