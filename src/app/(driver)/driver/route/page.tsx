"use client";

import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/driver/route-map").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-10rem)] items-center justify-center rounded-lg border bg-muted">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
});

export default function DriverRoutePage() {
  return <RouteMap />;
}
