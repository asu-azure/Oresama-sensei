"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveChatModel } from "@/lib/claude";
import type { UiMessage } from "./chat-client";

const PAGE_SIZE = 30;

export type OlderMessages = {
  messages: UiMessage[];
  oldestCursor: string | null;
  hasMore: boolean;
};

/** Load a window of messages older than `beforeIso` for a conversation the
 *  current user owns (RLS enforces ownership). Returned ascending (old -> new). */
export async function loadOlderMessages(
  conversationId: string,
  beforeIso: string,
  limit: number = PAGE_SIZE,
): Promise<OlderMessages> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { messages: [], oldestCursor: null, hasMore: false };

  const { data } = await supabase
    .from("messages")
    .select("id,role,content,created_at")
    .eq("conversation_id", conversationId)
    .lt("created_at", beforeIso)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  const rows = (data ?? []) as {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];

  const hasMore = rows.length > limit;
  const page = (hasMore ? rows.slice(0, limit) : rows).reverse();
  const messages: UiMessage[] = page.map((r) => ({
    id: r.id,
    role: r.role,
    content: r.content,
  }));
  const oldestCursor = page.length > 0 ? page[0].created_at : null;
  return { messages, oldestCursor, hasMore };
}

/** Remember the learner's chosen chat model as their default (the header
 *  dropdown). Best-effort: degrades silently if migration 0018 hasn't run. */
export async function setChatModel(model: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ chat_model: resolveChatModel(model) })
      .eq("id", user.id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/** Delete a conversation (messages cascade via FK) and return to a fresh chat. */
export async function deleteConversation(formData: FormData): Promise<void> {
  const id = String(formData.get("conversationId") ?? "");
  if (!id) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("conversations").delete().eq("id", id);
  revalidatePath("/chat");
  redirect("/chat");
}

/** Rename a conversation (from the drawer). Revalidates, stays on the page. */
export async function renameConversation(formData: FormData): Promise<void> {
  const id = String(formData.get("conversationId") ?? "");
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 80);
  if (!id || !title) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("conversations").update({ title }).eq("id", id);
  revalidatePath("/chat");
}