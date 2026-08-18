"use server";

import { createClient } from "@/lib/supabase/server";

/** Save/replace the learner's personal note on a knowledge item. RLS scopes the
 *  write to the owner. */
export async function savePersonalNote(
  itemId: string,
  note: string,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("knowledge_items")
    .update({ personal_note: note.trim() || null })
    .eq("id", itemId)
    .eq("user_id", user.id);
  return { ok: !error };
}

/** Append a block of text (e.g. a helpful Sensei reply) to the personal note,
 *  separated from any existing note. Returns the new combined note on success. */
export async function appendPersonalNote(
  itemId: string,
  addition: string,
): Promise<{ ok: boolean; note?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: row } = await supabase
    .from("knowledge_items")
    .select("personal_note")
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();

  const existing = (row?.personal_note ?? "").trim();
  const next = existing
    ? `${existing}\n\n---\n\n${addition.trim()}`
    : addition.trim();

  const { error } = await supabase
    .from("knowledge_items")
    .update({ personal_note: next })
    .eq("id", itemId)
    .eq("user_id", user.id);
  return { ok: !error, note: next };
}

/** Park ("suspend") an item, or bring it back.
 *
 *  Words are extracted automatically from chats and photographed pages, so the
 *  library accumulates things the learner never chose to study. Parking takes
 *  one out of the review and new queues for good — it stays in the library
 *  (and in the stats) and can be un-parked at any time.
 *
 *  Returns ok:false rather than throwing if migration 0024 hasn't been run. */
export async function setItemSuspended(
  itemId: string,
  suspended: boolean,
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("knowledge_items")
    .update({ srs_suspended: suspended })
    .eq("id", itemId)
    .eq("user_id", user.id);
  return { ok: !error };
}
