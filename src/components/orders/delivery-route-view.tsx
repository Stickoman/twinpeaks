"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Route, Clock, Ruler, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DeliveryRoute } from "@/types/database";

// Lazy load the map to avoid SSR issues
const RouteMapInner = dynamic(() => import("./delivery-route-map-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[300px] w-full rounded-lg" />,
});

async function fetchRoute(orderId: string): Promise<DeliveryRoute | null> {
  const res = await fetch(`/api/orders/${orderId}/delivery-route`);
  if (!res.ok) return null;
  const data = (await res.json()) as { route: DeliveryRoute | null };
  return data.route;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt || !completedAt) return "N/A";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}min`;
}

export function DeliveryRouteView({ orderId }: { orderId: string }) {
  const {
    data: route,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["delivery-route", orderId],
    queryFn: () => fetchRoute(orderId),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (isError || !route || route.route_points.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Route className="size-4" />
          Delivery Route
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <RouteMapInner routePoints={route.route_points} />

        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {route.distance_km != null && (
            <span className="flex items-center gap-1">
              <Ruler className="size-3" />
              {route.distance_km.toFixed(1)} km
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDuration(route.started_at, route.completed_at)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            {route.route_points.length} points
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
