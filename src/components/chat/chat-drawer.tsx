"use client";

import { useState } from "react";
import { ArrowLeft, MessageCircle, Plus, X, Loader2, Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChatStore, closeChat, setActiveConversation } from "@/stores/chat-store";
import { useConversations, useCreateConversation } from "@/hooks/use-chat";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";

interface DriverOption {
  id: string;
  username: string;
}

type DrawerView = "conversations" | "new" | "messages";

export function ChatDrawer({ bottomOffset }: { bottomOffset?: string } = {}) {
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return res.json() as Promise<{ userId: string; role: string }>;
    },
    staleTime: Infinity,
  });
  const currentUserId = me?.userId ?? "";
  const isAdmin = me?.role === "admin" || me?.role === "super_admin" || me?.role === "god_admin";
  const { isOpen, activeConversationId } = useChatStore();
  const { data: conversations = [] } = useConversations();
  const createConversation = useCreateConversation();

  const [view, setView] = useState<DrawerView>("conversations");
  const [driverSearch, setDriverSearch] = useState("");

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ["drivers-for-chat"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) return [];
      return res.json() as Promise<DriverOption[]>;
    },
    enabled: isOpen && isAdmin,
    staleTime: 60_000,
  });

  const filteredDrivers = drivers.filter((d) =>
    d.username.toLowerCase().includes(driverSearch.toLowerCase()),
  );

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // Determine the effective view
  const effectiveView: DrawerView = activeConversationId ? "messages" : view;

  function handleBack() {
    if (effectiveView === "messages") {
      setActiveConversation(null);
      setView("conversations");
    } else if (effectiveView === "new") {
      setView("conversations");
      setDriverSearch("");
    }
  }

  async function handleSelectDriver(driverId: string) {
    try {
      const conv = await createConversation.mutateAsync(driverId);
      setView("conversations");
      setDriverSearch("");
      setActiveConversation(conv.id);
    } catch {
      // Error handled by mutation
    }
  }

  const headerTitle =
    effectiveView === "messages" && activeConv
      ? activeConv.participant_name
      : effectiveView === "new"
        ? "New Conversation"
        : "Messages";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className={cn(
            "fixed right-0 top-16 z-[60] flex w-full max-w-sm flex-col border-l bg-background shadow-xl",
            bottomOffset ?? "bottom-0",
          )}
        >
          {/* Header */}
          <div className="flex h-14 items-center gap-3 border-b px-4">
            {effectiveView !== "conversations" ? (
              <Button variant="ghost" size="icon" className="size-8" onClick={handleBack}>
                <ArrowLeft className="size-4" />
              </Button>
            ) : (
              <MessageCircle className="size-5" />
            )}
            <h3 className="flex-1 text-sm font-semibold">{headerTitle}</h3>
            {effectiveView === "conversations" && isAdmin && (
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setView("new")}>
                <Plus className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="size-8" onClick={closeChat}>
              <X className="size-4" />
            </Button>
          </div>

          {/* Content */}
          {effectiveView === "messages" && activeConversationId ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <ChatMessageList
                conversationId={activeConversationId}
                currentUserId={currentUserId}
              />
              <ChatInput conversationId={activeConversationId} />
            </div>
          ) : effectiveView === "new" ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Search input */}
              <div className="border-b px-4 py-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search drivers..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Driver list */}
              <div className="flex-1 overflow-y-auto">
                {filteredDrivers.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">No drivers found</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredDrivers.map((driver) => (
                      <button
                        key={driver.id}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 disabled:opacity-50"
                        onClick={() => handleSelectDriver(driver.id)}
                        disabled={createConversation.isPending}
                      >
                        <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {driver.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{driver.username}</p>
                        </div>
                        {createConversation.isPending && (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                  <MessageCircle className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No conversations yet</p>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => setView("new")}
                    >
                      <Plus className="size-4" />
                      Start a conversation
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {conversations.map((conv) => (
                    <button
                      key={conv.id}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => setActiveConversation(conv.id)}
                    >
                      <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {conv.participant_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{conv.participant_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(conv.last_message_at).toLocaleDateString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
