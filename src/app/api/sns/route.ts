import { createClient } from "@/lib/supabase/server";
import { generateSnsOptions, extractKnowledge } from "@/lib/claude";
import { getAiEngine } from "@/lib/ai-engine";
import { storeKnowledge } from "@/lib/memory";
import type { Profile, SnsInputs, SnsMode, SnsRegister } from "@/lib/types";

const MODES: SnsMode[] = ["reply", "compose", "explain"];
const REGISTERS: SnsRegister[] = ["casual", "friendly", "polite"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let body: Partial<SnsInputs>;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const mode: SnsMode = MODES.includes(body.mode as SnsMode)
    ? (body.mode as SnsMode)
    : "reply";
  const register: SnsRegister = REGISTERS.includes(body.register as SnsRegister)
    ? (body.register as SnsRegister)
    : "friendly";
  const inputs: SnsInputs = {
    mode,
    register,
    posted: (body.posted ?? "").trim() || undefined,
    incoming: (body.incoming ?? "").trim() || undefined,
    intent: (body.intent ?? "").trim() || undefined,
    extra: (body.extra ?? "").trim() || undefined,
  };

  // Need at least one piece of content to work with.
  if (!inputs.posted && !inputs.incoming && !inputs.intent && !inputs.extra) {
    return new Response("Add some context first.", { status: 400 });
  }

  const [{ data: profile }, engine] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    getAiEngine(supabase, user.id),
  ]);

  const result = await generateSnsOptions({
    inputs,
    profile: profile as Profile | null,
    engine,
  });

  if (result.options.length === 0 && !result.explanation) {
    return new Response("Couldn't generate suggestions — try rephrasing.", {
      status: 502,
    });
  }

  // Save to history (best-effort; degrades if migration 0019 hasn't run).
  let interactionId: string | null = null;
  try {
    const { data } = await supabase
      .from("sns_interactions")
      .insert({
        user_id: user.id,
        mode: inputs.mode,
        inputs,
        options: result.options,
        note: result.note,
        explanation: result.explanation || null,
      })
      .select("id")
      .single();
    interactionId = data?.id ?? null;
  } catch {
    // table missing — skip history
  }

  // Auto-extract any vocab/grammar from the produced Japanese into the library
  // (all JLPT levels, incl. N1+). Best-effort and non-blocking for the response
  // shape, but awaited so it persists before the function ends.
  try {
    const ja = result.options.map((o) => o.japanese).filter(Boolean);
    if (ja.length > 0) {
      const content =
        `Natural Japanese SNS phrasings the learner is studying:\n` +
        ja.map((s, i) => `${i + 1}. ${s}`).join("\n");
      const items = await extractKnowledge(content, engine);
      if (items.length > 0) {
        await storeKnowledge(supabase, user.id, items, {
          source: "chat",
          source_type: "sns",
        });
      }
    }
  } catch (e) {
    console.error("sns extraction failed:", e);
  }

  return Response.json({ id: interactionId, ...result });
}
