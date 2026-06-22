import { createClient } from "@/lib/supabase/server";
import { reviewSnsDraft } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";
import type { Profile } from "@/lib/types";

const MAX_CHARS = 1000;

/** Teacher feedback on the learner's OWN edited SNS draft, and (best-effort)
 *  log the correction to sns_corrections for growth tracking. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: {
    draft?: string;
    original?: string;
    situation?: string;
    register?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const draft = (body.draft ?? "").trim();
  if (!draft) return new Response("Write your version first.", { status: 400 });
  if (draft.length > MAX_CHARS) {
    return new Response(`Draft too long (max ${MAX_CHARS} characters).`, {
      status: 413,
    });
  }
  const original = (body.original ?? "").trim() || undefined;
  const situation = (body.situation ?? "").trim() || undefined;
  const register = (body.register ?? "").trim() || undefined;

  const [{ data: profile }, engine] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getAiEngine(supabase, user.id),
  ]);

  const review = await reviewSnsDraft({
    draft,
    original,
    situation,
    register,
    profile: profile as Profile | null,
    engine,
  });

  if (!review) {
    return new Response("Couldn't review that — try again.", { status: 502 });
  }

  // Save to the learner error log (best-effort; degrades if 0020 hasn't run).
  let id: string | null = null;
  try {
    const { data } = await supabase
      .from("sns_corrections")
      .insert({
        user_id: user.id,
        draft,
        corrected: review.corrected,
        original: original ?? null,
        rating: review.rating,
        errors: review.errors,
        feedback: review.feedback || null,
      })
      .select("id")
      .single();
    id = data?.id ?? null;
  } catch {
    // table missing — skip logging
  }

  return Response.json({ id, ...review });
}
