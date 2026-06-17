"use server";

import { createClient } from "@/lib/supabase/server";
import { generateKanjiMnemonic } from "@/lib/claude";
import { getInfo, getStrokes } from "@/lib/kanji";
import type { Profile } from "@/lib/types";

/** Return the cached mnemonic for a kanji, generating + caching it on first ask. */
export async function getOrGenerateMnemonic(
  char: string,
): Promise<{ mnemonic: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: existing } = await supabase
    .from("kanji")
    .select("mnemonic")
    .eq("user_id", user.id)
    .eq("character", char)
    .maybeSingle();
  if (existing?.mnemonic) return { mnemonic: existing.mnemonic };

  const [info, strokes, { data: profile }] = await Promise.all([
    getInfo(char),
    getStrokes(char),
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
  ]);

  let mnemonic = "";
  try {
    mnemonic = await generateKanjiMnemonic({
      char,
      info,
      components: strokes?.components ?? [],
      profile: profile as Profile | null,
    });
  } catch (e) {
    console.error("kanji mnemonic generation failed:", e);
    return { error: "Couldn't generate a mnemonic right now." };
  }
  if (!mnemonic) return { error: "Couldn't generate a mnemonic right now." };

  const { error } = await supabase
    .from("kanji")
    .upsert(
      {
        user_id: user.id,
        character: char,
        mnemonic,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,character" },
    );
  if (error) {
    console.error("kanji upsert failed:", error.message);
    // Still return the text so the user sees it this session.
  }
  return { mnemonic };
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
