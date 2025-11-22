"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map as GoogleMap, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Navigation, Route, Loader2, Clock } from "lucide-react";
import { useMapTheme } from "@/hooks/use-map-theme";
import type { OrderWithItems } from "@/types/database";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface MapDefaults {
  default_latitude: number;
  default_longitude: number;
}

interface DriverOrdersResponse {
  assigned: OrderWithItems[];
  pending: OrderWithItems[];
  is_trusted: boolean;
}

interface GeocodedOrder {
  order: OrderWithItems;
  lat: number;
  lng: number;
}

interface OptimizeResponse {
  optimized_order: string[];
  orders: { id: string; address: string; latitude: number; longitude: number }[];
  total_distance_km: number;
  source: string;
  polyline: string | null;
  legs: { distance_m: number; duration_seconds: number }[] | null;
  total_distance_m: number | null;
  total_duration_seconds: number | null;
}

// ────────────────────────────────────────────────────────────
// Data fetchers
// ────────────────────────────────────────────────────────────

async function fetchMyOrders(): Promise<OrderWithItems[]> {
  const res = await fetch("/api/driver/orders");
  if (!res.ok) throw new Error("Failed to load orders");
  const data = (await res.json()) as DriverOrdersResponse;
  return data.assigned;
}

async function fetchMapDefaults(): Promise<MapDefaults> {
  const res = await fetch("/api/settings");
  if (!res.ok) return { default_latitude: 40.7128, default_longitude: -74.006 };
  const data = (await res.json()) as MapDefaults;
  return {
    default_latitude: data.default_latitude ?? 40.7128,
    default_longitude: data.default_longitude ?? -74.006,
  };
}

async function batchGeocode(addresses: string[]): Promise<({ lat: number; lng: number } | null)[]> {
  const res = await fetch("/api/maps/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });
  if (!res.ok) return addresses.map(() => null);
  const data = (await res.json()) as { results: ({ lat: number; lng: number } | null)[] };
  return data.results;
}

// ────────────────────────────────────────────────────────────
// Polyline renderer (encoded polyline → google.maps.Polyline)
// ────────────────────────────────────────────────────────────

function EncodedPolyline({ encodedPath }: { encodedPath: string }) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !encodedPath) return;

    const path = google.maps.geometry.encoding.decodePath(encodedPath);
    polylineRef.current = new google.maps.Polyline({
      path,
      strokeColor: "#3b82f6",
      strokeWeight: 4,
      strokeOpacity: 0.9,
      map,
    });

    return () => {
      polylineRef.current?.setMap(null);
    };
  }, [map, encodedPath]);

  return null;
}

// ────────────────────────────────────────────────────────────
// Fit bounds helper
// ────────────────────────────────────────────────────────────

function FitBounds({
  positions,
  userPos,
}: {
  positions: { lat: number; lng: number }[];
  userPos: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || positions.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    positions.forEach((p) => bounds.extend(p));
    if (userPos) bounds.extend(userPos);

    if (positions.length === 1 && !userPos) {
      map.setCenter(positions[0]);
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 60);
    }
  }, [map, positions, userPos]);

  return null;
}

// ────────────────────────────────────────────────────────────
// Format helpers
// ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  return `${hours}h${remaining > 0 ? ` ${remaining}min` : ""}`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function openGoogleMapsNav(lat: number, lng: number) {
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    "_blank",
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

export function RouteMap() {
  const { styles: mapStyles, mapId, colorScheme } = useMapTheme();
  const [geocoded, setGeocoded] = useState<GeocodedOrder[]>([]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimized, setOptimized] = useState<OptimizeResponse | null>(null);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ["driver-orders-assigned"],
    queryFn: fetchMyOrders,
  });

  const { data: mapDefaults } = useQuery({
    queryKey: ["map-defaults"],
    queryFn: fetchMapDefaults,
    staleTime: 5 * 60 * 1000,
  });

  const activeOrders = orders.filter((o) => o.status === "assigned" || o.status === "en_route");

  // Get user position
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
    );
  }, []);

  // Batch geocode orders missing coordinates
  useEffect(() => {
    let cancelled = false;

    async function geocodeAll() {
      const withCoords: GeocodedOrder[] = [];
      const needGeocode: { index: number; order: OrderWithItems }[] = [];

      activeOrders.forEach((order, i) => {
        if (order.latitude && order.longitude) {
          withCoords.push({ order, lat: order.latitude, lng: order.longitude });
        } else {
          needGeocode.push({ index: i, order });
        }
      });

      if (needGeocode.length > 0) {
        const addresses = needGeocode.map((n) => n.order.address);
        const results = await batchGeocode(addresses);
        if (cancelled) return;

        results.forEach((result, i) => {
          if (result) {
            withCoords.push({
              order: needGeocode[i].order,
              lat: result.lat,
              lng: result.lng,
            });
          }
        });
      }

      if (!cancelled) setGeocoded(withCoords);
    }

    if (activeOrders.length > 0) {
      geocodeAll();
    } else {
      setGeocoded([]);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrders.length]);

  // Optimize route
  const handleOptimize = useCallback(async () => {
    if (geocoded.length === 0) return;

    setIsOptimizing(true);
    try {
      const res = await fetch("/api/driver/route-optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: geocoded.map((g) => g.order.id),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as OptimizeResponse;
        setOptimized(data);

        // Reorder geocoded list to match optimized order
        const orderMap = new Map(geocoded.map((g) => [g.order.id, g]));
        const reordered = data.optimized_order
          .map((id) => orderMap.get(id))
          .filter((g): g is GeocodedOrder => g != null);
        setGeocoded(reordered);
      }
    } catch {
      // Optimization failed silently
    }
    setIsOptimizing(false);
  }, [geocoded]);

  const center = userPos ??
    geocoded[0] ?? {
      lat: mapDefaults?.default_latitude ?? 40.7128,
      lng: mapDefaults?.default_longitude ?? -74.006,
    };

  if (activeOrders.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
            <Route className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No active deliveries to show on map</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border">
      {/* Map */}
      <div className="relative">
        <GoogleMap
          className="h-[calc(100dvh-18rem)] w-full"
          defaultCenter={center}
          defaultZoom={13}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId={mapId}
          colorScheme={colorScheme}
          styles={mapStyles}
        >
          <FitBounds
            positions={geocoded.map((g) => ({ lat: g.lat, lng: g.lng }))}
            userPos={userPos}
          />

          {/* Encoded polyline from Google Directions */}
          {optimized?.polyline && <EncodedPolyline encodedPath={optimized.polyline} />}

          {/* Driver position — blue dot */}
          {userPos && (
            <AdvancedMarker position={userPos} title="You">
              <div className="relative">
                <div className="size-4 rounded-full border-2 border-white bg-blue-500 shadow-lg" />
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
              </div>
            </AdvancedMarker>
          )}

          {/* Numbered stop markers */}
          {geocoded.map((g, i) => (
            <AdvancedMarker
              key={g.order.id}
              position={{ lat: g.lat, lng: g.lng }}
              title={g.order.address}
              onClick={() => setSelectedStop(g.order.id === selectedStop ? null : g.order.id)}
            >
              <div className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-primary text-xs font-bold text-primary-foreground shadow-lg">
                {i + 1}
              </div>
            </AdvancedMarker>
          ))}
        </GoogleMap>

        {/* Optimize FAB */}
        {geocoded.length >= 2 && (
          <Button
            onClick={handleOptimize}
            disabled={isOptimizing}
            className="absolute bottom-4 right-4 z-10 shadow-lg"
            size="sm"
          >
            {isOptimizing ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Route className="mr-1.5 size-4" />
            )}
            {isOptimizing ? "Optimizing..." : "Optimize Route"}
          </Button>
        )}
      </div>

      {/* Route summary header */}
      {optimized && (
        <div className="flex items-center gap-3 border-t bg-muted/50 px-4 py-2.5">
          {optimized.total_duration_seconds != null && (
            <span className="flex items-center gap-1 text-sm font-medium">
              <Clock className="size-3.5" />
              {formatDuration(optimized.total_duration_seconds)}
            </span>
          )}
          {optimized.total_distance_m != null && (
            <span className="text-sm text-muted-foreground">
              {formatDistance(optimized.total_distance_m)}
            </span>
          )}
          <Badge variant="outline" className="ml-auto text-xs">
            {optimized.source}
          </Badge>
        </div>
      )}

      {/* Stop list (bottom sheet) */}
      <div className="max-h-[35dvh] space-y-1 overflow-y-auto border-t p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{geocoded.length} stops</p>
        {geocoded.map((g, i) => {
          const leg = optimized?.legs?.[i];
          const isSelected = selectedStop === g.order.id;

          return (
            <div
              key={g.order.id}
              className={`flex items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                isSelected ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => setSelectedStop(isSelected ? null : g.order.id)}
            >
              <Badge
                variant={isSelected ? "default" : "outline"}
                className="size-7 shrink-0 justify-center"
              >
                {i + 1}
              </Badge>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{g.order.address}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{g.order.order_items.length} items</span>
                  {leg && (
                    <>
                      <span>{formatDistance(leg.distance_m)}</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-3" />
                        {formatDuration(leg.duration_seconds)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  openGoogleMapsNav(g.lat, g.lng);
                }}
              >
                <Navigation className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
