"use client";

import { useState, useCallback } from "react";
import { registerServiceWorker, urlBase64ToUint8Array } from "@/lib/utils/service-worker";

type PushStatus = "idle" | "prompting" | "subscribing" | "subscribed" | "denied" | "unsupported";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function usePushSubscription(orderId: string) {
  const [status, setStatus] = useState<PushStatus>(() => {
    if (typeof window === "undefined") return "idle";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return "idle";
  });

  const subscribe = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    setStatus("prompting");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }

    setStatus("subscribing");

    try {
      const registration = await registerServiceWorker();
      if (!registration) {
        setStatus("denied");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });

      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) {
        setStatus("denied");
        return;
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_id: orderId,
          endpoint: subscription.endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
        }),
      });

      if (res.ok) {
        setStatus("subscribed");
      } else {
        setStatus("denied");
      }
    } catch (err) {
      console.error("Push subscription failed:", err);
      setStatus("denied");
    }
  }, [orderId]);

  return { status, subscribe };
}
