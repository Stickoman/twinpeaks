"use client";

import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushSubscription } from "@/hooks/use-push-subscription";

interface NotificationPromptProps {
  orderId: string;
}

export function NotificationPrompt({ orderId }: NotificationPromptProps) {
  const { status, subscribe } = usePushSubscription(orderId);

  if (status === "unsupported") return null;

  if (status === "subscribed") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
        <Check className="size-4 shrink-0" />
        <span>Notifications enabled — we will notify you when your driver is on the way.</span>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
        <BellOff className="size-4 shrink-0" />
        <span>Notifications are disabled. Keep this page open to track your order.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
        <Bell className="size-4 shrink-0" />
        Get notified when your driver is on the way?
      </div>
      <p className="text-xs text-blue-600 dark:text-blue-400">
        Enable push notifications so you don&apos;t have to keep this page open. Do not refresh this
        page after ordering.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={subscribe}
        disabled={status === "prompting" || status === "subscribing"}
      >
        {(status === "prompting" || status === "subscribing") && (
          <Loader2 className="size-3.5 animate-spin" />
        )}
        {status === "prompting" ? "Requesting permission..." : "Enable Notifications"}
      </Button>
    </div>
  );
}
