import { createClient } from "@/lib/supabase/server";
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

  // Active conversation: ?c=<id> if it belongs to the user, else the most recent.
  let activeId: string | null = null;
  if (c && conversations.some((x) => x.id === c)) {
    activeId = c;
  } else if (conversations.length > 0) {
    activeId = conversations[0].id;
  }

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
    />
  );
}