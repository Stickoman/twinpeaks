"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSendMessage } from "@/hooks/use-chat";

interface ChatInputProps {
  conversationId: string;
}

export function ChatInput({ conversationId }: ChatInputProps) {
  const [text, setText] = useState("");
  const sendMessage = useSendMessage(conversationId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-3">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type a message..."
        maxLength={2000}
        disabled={sendMessage.isPending}
        className="flex-1"
      />
      <Button
        type="submit"
        size="icon"
        disabled={!text.trim() || sendMessage.isPending}
        className="shrink-0"
      >
        {sendMessage.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </form>
  );
}
