import { createClient } from "@/lib/supabase/server";
import { ChatClient, type UiMessage } from "./chat-client";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: convo } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialMessages: UiMessage[] = [];
  if (convo) {
    const { data } = await supabase
      .from("messages")
      .select("id,role,content")
      .eq("conversation_id", convo.id)
      .order("created_at", { ascending: true });
    initialMessages = (data ?? []) as UiMessage[];
  }

  return (
    <ChatClient
      initialConversationId={convo?.id ?? null}
      initialMessages={initialMessages}
    />
  );
}
