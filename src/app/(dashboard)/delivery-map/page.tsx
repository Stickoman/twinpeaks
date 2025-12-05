"use client";

import dynamic from "next/dynamic";

const DeliveryMap = dynamic(
  () => import("@/components/delivery-map/delivery-map").then((m) => m.DeliveryMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100dvh-12rem)] items-center justify-center rounded-xl border bg-muted">
        <p className="text-sm text-muted-foreground">Loading map...</p>
      </div>
    ),
  },
);

export default function DeliveryMapPage() {
  return <DeliveryMap />;
}
