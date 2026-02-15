import { useSyncExternalStore } from "react";

// ────────────────────────────────────────────────────────────
// Chat Store — lightweight reactive store (no external deps)
// ────────────────────────────────────────────────────────────

export interface ChatState {
  isOpen: boolean;
  activeConversationId: string | null;
  unreadCount: number;
}

const INITIAL_STATE: ChatState = {
  isOpen: false,
  activeConversationId: null,
  unreadCount: 0,
};

let state: ChatState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function getSnapshot(): ChatState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatStore(): ChatState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function openChat(conversationId?: string) {
  state = {
    ...state,
    isOpen: true,
    activeConversationId: conversationId ?? state.activeConversationId,
  };
  notify();
}

export function closeChat() {
  state = { ...state, isOpen: false };
  notify();
}

export function setActiveConversation(id: string | null) {
  state = { ...state, activeConversationId: id };
  notify();
}

export function setUnreadCount(count: number) {
  state = { ...state, unreadCount: count };
  notify();
}
