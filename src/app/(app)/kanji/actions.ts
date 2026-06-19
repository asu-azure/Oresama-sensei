"use server";

import { createClient } from "@/lib/supabase/server";
import { generateKanjiMnemonic } from "@/lib/claude";
import { storeKnowledge } from "@/lib/memory";
import { getInfo, getStrokes } from "@/lib/kanji";
import type { Profile } from "@/lib/types";

export type MnemonicExample = {
  term: string;
  reading: string | null;
  meaning: string | null;
  example: string | null;
};

export type MnemonicResult = { mnemonic: string; examples: MnemonicExample[] };

/** Return the cached mnemonic (+ example words) for a kanji, generating and
 *  caching it on first ask. `model` picks Claude (default) or the cheaper Gemini.
 *  Generated example words are added to the learner's library (source: kanji). */
export async function getOrGenerateMnemonic(
  char: string,
  model: "claude" | "gemini" = "claude",
): Promise<MnemonicResult | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Read cache. `examples` may not exist yet (migration 0014) — fall back.
  let existing: { mnemonic: string | null; examples?: unknown } | null = null;
  const cached = await supabase
    .from("kanji")
    .select("mnemonic, examples")
    .eq("user_id", user.id)
    .eq("character", char)
    .maybeSingle();
  if (cached.error) {
    const fallback = await supabase
      .from("kanji")
      .select("mnemonic")
      .eq("user_id", user.id)
      .eq("character", char)
      .maybeSingle();
    existing = fallback.data ?? null;
  } else {
    existing = cached.data;
  }
  if (existing?.mnemonic) {
    return {
      mnemonic: existing.mnemonic,
      examples: Array.isArray(existing.examples)
        ? (existing.examples as MnemonicExample[])
        : [],
    };
  }

  const [info, strokes, { data: profile }] = await Promise.all([
    getInfo(char),
    getStrokes(char),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  let result: { mnemonic: string; examples: MnemonicExample[] };
  try {
    const gen = await generateKanjiMnemonic({
      char,
      info,
      components: strokes?.components ?? [],
      profile: profile as Profile | null,
      model,
    });
    result = {
      mnemonic: gen.mnemonic,
      examples: gen.examples.map((e) => ({
        term: e.term,
        reading: e.reading ?? null,
        meaning: e.meaning ?? null,
        example: e.example ?? null,
      })),
    };
    // Add the generated example words to the learner's library (deduped).
    if (gen.examples.length > 0) {
      try {
        await storeKnowledge(supabase, user.id, gen.examples, {
          source: "lesson",
          source_type: "kanji",
        });
      } catch (e) {
        console.error("kanji examples store failed:", e);
      }
    }
  } catch (e) {
    console.error("kanji mnemonic generation failed:", e);
    return { error: "Couldn't generate a mnemonic right now." };
  }
  if (!result.mnemonic) return { error: "Couldn't generate a mnemonic right now." };

  // Cache mnemonic (+ examples when the column exists).
  const base = {
    user_id: user.id,
    character: char,
    mnemonic: result.mnemonic,
    updated_at: new Date().toISOString(),
  };
  const withExamples = await supabase
    .from("kanji")
    .upsert({ ...base, examples: result.examples }, {
      onConflict: "user_id,character",
    });
  if (withExamples.error) {
    // examples column may not exist yet — cache the mnemonic alone.
    await supabase
      .from("kanji")
      .upsert(base, { onConflict: "user_id,character" });
  }
  return result;
}

/** Flip the "learned" flag for a kanji (creates the row if needed). */
export async function setLearned(char: string, learned: boolean): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("kanji").upsert(
    {
      user_id: user.id,
      character: char,
      learned,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,character" },
  );
}

/** Mark several kanji learned/unlearned at once (batch select on the list page). */
export async function setManyLearned(
  chars: string[],
  learned: boolean,
): Promise<void> {
  if (chars.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const now = new Date().toISOString();
  const rows = chars.slice(0, 500).map((character) => ({
    user_id: user.id,
    character,
    learned,
    updated_at: now,
  }));
  await supabase
    .from("kanji")
    .upsert(rows, { onConflict: "user_id,character" });
}
