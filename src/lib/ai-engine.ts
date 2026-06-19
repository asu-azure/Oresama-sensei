import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveEngine, type AiEngine } from "@/lib/claude";

/** Read the user's chosen AI engine for secondary calls from their profile.
 *  Defaults to Gemini (cheaper) and degrades gracefully if migration 0015
 *  hasn't run (the column won't exist → treated as gemini). */
export async function getAiEngine(
  supabase: SupabaseClient,
  userId: string,
): Promise<AiEngine> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("ai_engine")
      .eq("id", userId)
      .maybeSingle();
    return resolveEngine((data as { ai_engine?: string } | null)?.ai_engine);
  } catch {
    return "gemini";
  }
}
