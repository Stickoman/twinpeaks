"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMessages, useMarkRead } from "@/hooks/use-chat";

interface ChatMessageListProps {
  conversationId: string;
  currentUserId: string;
}

export function ChatMessageList({ conversationId, currentUserId }: ChatMessageListProps) {
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const markRead = useMarkRead(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages.length > 0) {
      markRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-2 overflow-y-auto p-3">
      {messages.map((msg) => {
        const isMine = msg.sender_id === currentUserId;
        return (
          <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                isMine
                  ? "rounded-br-md bg-primary text-primary-foreground"
                  : "rounded-bl-md bg-muted text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <p
                className={cn(
                  "mt-0.5 text-[10px]",
                  isMine ? "text-primary-foreground/60" : "text-muted-foreground",
                )}
              >
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
