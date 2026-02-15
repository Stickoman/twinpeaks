"use client";

import { useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRealtimeInserts } from "@/lib/hooks/use-realtime";
import { setUnreadCount } from "@/stores/chat-store";

interface Conversation {
  id: string;
  admin_id: string;
  driver_id: string;
  last_message_at: string;
  participant_name: string;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

interface RealtimeMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export function useConversations() {
  return useQuery({
    queryKey: ["chat-conversations"],
    queryFn: async () => {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) throw new Error("Failed to load conversations");
      const data = (await res.json()) as { conversations: Conversation[] };
      return data.conversations;
    },
    refetchInterval: 30_000,
  });
}

export function useMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      const data = (await res.json()) as { messages: Message[] };
      return data.messages;
    },
    enabled: !!conversationId,
    refetchInterval: 10_000,
  });

  // Realtime updates for new messages
  const handleNewMessage = useCallback(
    (msg: RealtimeMessage) => {
      if (msg.conversation_id === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ["chat-unread"] });
    },
    [conversationId, queryClient],
  );

  useRealtimeInserts<RealtimeMessage>("chat_messages", handleNewMessage);

  return query;
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json() as Promise<{ message: Message }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useMarkRead(conversationId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!conversationId) return;
      await fetch(`/api/chat/conversations/${conversationId}/read`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-unread"] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (driverId: string) => {
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driver_id: driverId }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = (await res.json()) as { conversation: { id: string } };
      return data.conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
  });
}

export function useUnreadCount() {
  const query = useQuery({
    queryKey: ["chat-unread"],
    queryFn: async () => {
      const res = await fetch("/api/chat/unread");
      if (!res.ok) return 0;
      const data = (await res.json()) as { count: number };
      return data.count;
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    setUnreadCount(query.data ?? 0);
  }, [query.data]);

  return query.data ?? 0;
}
