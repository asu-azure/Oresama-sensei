import { createClient } from "@/lib/supabase/server";
import { SnsClient } from "./sns-client";
import type { SnsInteraction } from "@/lib/types";

export default async function SnsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Recent history (best-effort; empty if migration 0019 hasn't run yet).
  let history: SnsInteraction[] = [];
  try {
    const { data } = await supabase
      .from("sns_interactions")
      .select("id,inputs,options,note,explanation,created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(20);
    history = (data ?? []) as unknown as SnsInteraction[];
  } catch {
    // table missing — no history
  }

  return <SnsClient initialHistory={history} />;
}
