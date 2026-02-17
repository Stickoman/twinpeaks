"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatStore, openChat, closeChat } from "@/stores/chat-store";
import { useUnreadCount } from "@/hooks/use-chat";

export function ChatFAB() {
  const { isOpen } = useChatStore();
  const unread = useUnreadCount();

  return (
    <Button
      size="icon"
      aria-label={isOpen ? "Close chat" : "Open chat"}
      className="fixed bottom-20 right-4 z-50 size-12 rounded-full shadow-lg"
      onClick={() => (isOpen ? closeChat() : openChat())}
    >
      <MessageCircle className="size-5" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Button>
  );
}
