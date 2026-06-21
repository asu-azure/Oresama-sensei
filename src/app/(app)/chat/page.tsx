import { createClient } from "@/lib/supabase/server";
import { resolveChatModel } from "@/lib/claude";
import { ChatClient, type UiMessage } from "./chat-client";
import type { ConversationSummary } from "./conversation-drawer";

const PAGE_SIZE = 30;

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // All conversations for the drawer (most recent first).
  const { data: convoRows } = await supabase
    .from("conversations")
    .select("id,title,created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });
  const conversations = (convoRows ?? []) as ConversationSummary[];

  // The learner's saved default chat model (degrades to Gemini Flash if the
  // column / migration 0018 isn't present yet).
  let chatModel = "gemini-flash";
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("chat_model")
      .eq("id", user!.id)
      .maybeSingle();
    chatModel = resolveChatModel(
      (prof as { chat_model?: string } | null)?.chat_model,
    );
  } catch {
    // column missing — keep default
  }

  // Open a fresh blank chat by default; only resume a specific conversation when
  // ?c=<id> is given (e.g. tapping one in the drawer). Past chats stay reachable
  // via the ConversationDrawer.
  const activeId: string | null =
    c && conversations.some((x) => x.id === c) ? c : null;

  let initialMessages: UiMessage[] = [];
  let hasMore = false;
  let oldestCursor: string | null = null;

  if (activeId) {
    const { data } = await supabase
      .from("messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", activeId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1);
    const rows = (data ?? []) as {
      id: string;
      role: "user" | "assistant";
      content: string;
      created_at: string;
    }[];
    hasMore = rows.length > PAGE_SIZE;
    const page = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).reverse();
    initialMessages = page.map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
    }));
    oldestCursor = page.length > 0 ? page[0].created_at : null;
  }

  return (
    <ChatClient
      key={activeId ?? "new"}
      initialConversationId={activeId}
      initialMessages={initialMessages}
      initialHasMore={hasMore}
      initialOldestCursor={oldestCursor}
      conversations={conversations}
      initialChatModel={chatModel}
    />
  );
}