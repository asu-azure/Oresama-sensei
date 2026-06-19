import { createClient } from "@/lib/supabase/server";
import { runSummaryStream, resolveEngine } from "@/lib/claude";
import { buildSummarySystemPrompt } from "@/lib/prompts";
import type { Profile } from "@/lib/types";

type Item = {
  type: string;
  term: string;
  reading: string | null;
  meaning: string | null;
  jlpt_level: string | null;
};

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const [{ data: profile }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("knowledge_items")
      .select("type,term,reading,meaning,jlpt_level")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const list = (items ?? []) as Item[];
  if (list.length === 0) {
    return new Response(
      "Nothing saved yet — chat or upload a page first, then I can summarize.",
      { status: 422 },
    );
  }

  const digest = list
    .map((it) => {
      const bits = [`[${it.type}]`, it.term];
      if (it.reading) bits.push(`(${it.reading})`);
      if (it.meaning) bits.push(`— ${it.meaning}`);
      if (it.jlpt_level) bits.push(`[${it.jlpt_level}]`);
      return bits.join(" ");
    })
    .join("\n");

  const dateLabel = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const { data: lesson, error: lessonError } = await supabase
    .from("lessons")
    .insert({
      user_id: user.id,
      title: `Summary · ${dateLabel}`,
      kind: "summary",
    })
    .select("id")
    .single();
  if (lessonError || !lesson) {
    return new Response("Failed to create summary", { status: 500 });
  }
  const lessonId = lesson.id;

  const system = buildSummarySystemPrompt(profile as Profile | null);
  const engine = resolveEngine(
    (profile as { ai_engine?: string } | null)?.ai_engine,
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let article = "";
      let clientGone = false;
      const onDelta = (delta: string) => {
        article += delta;
        if (!clientGone) {
          try {
            controller.enqueue(encoder.encode(delta));
          } catch {
            clientGone = true;
          }
        }
      };

      try {
        await runSummaryStream({ system, digest, engine, onDelta });
      } catch (e) {
        console.error("summary generation error:", e);
      }

      try {
        if (article.trim()) {
          await supabase
            .from("lessons")
            .update({ article_md: article })
            .eq("id", lessonId);
        }
      } catch (e) {
        console.error("summary persistence failed:", e);
      }

      try {
        controller.close();
      } catch {
        // client already gone
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-lesson-id": lessonId,
    },
  });
}
