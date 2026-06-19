"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  // Try with the ai_engine column; if migration 0015 hasn't run, fall back.
  const withEngine = await supabase
    .from("profiles")
    .upsert({ ...base, ai_engine });
  if (withEngine.error) {
    await supabase.from("profiles").upsert(base);
  }

  revalidatePath("/settings");
}
