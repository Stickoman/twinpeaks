"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map as GoogleMap, AdvancedMarker, InfoWindow, useMap } from "@vis.gl/react-google-maps";
import { GoogleMapsProvider } from "@/components/ui/google-maps-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DriverMarker } from "@/components/ui/driver-marker";
import { useMapTheme } from "@/hooks/use-map-theme";
import { useRealtimeInserts } from "@/lib/hooks/use-realtime";
import type { DriverLocation } from "@/types/database";

interface DriverLocationAPI {
  id: string;
  username: string;
  phone: string | null;
  vehicle_info: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
    heading: number | null;
    speed: number | null;
    recorded_at: string;
  } | null;
}

interface DriverWithLocation {
  driver_id: string;
  username: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  recorded_at: string;
}

interface MapDefaults {
  default_latitude: number;
  default_longitude: number;
}

async function fetchDriverLocations(): Promise<DriverWithLocation[]> {
  const res = await fetch("/api/drivers/locations");
  if (!res.ok) throw new Error("Failed to fetch driver locations");
  const data = (await res.json()) as DriverLocationAPI[];
  return data
    .filter(
      (d): d is DriverLocationAPI & { location: NonNullable<DriverLocationAPI["location"]> } =>
        d.location !== null,
    )
    .map((d) => ({
      driver_id: d.id,
      username: d.username,
      latitude: d.location.latitude,
      longitude: d.location.longitude,
      heading: d.location.heading,
      speed: d.location.speed,
      recorded_at: d.location.recorded_at,
    }));
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

function FitDriverBounds({ drivers }: { drivers: DriverWithLocation[] }) {
  const map = useMap();

  useMemo(() => {
    if (!map || drivers.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    drivers.forEach((d) => bounds.extend({ lat: d.latitude, lng: d.longitude }));
    if (drivers.length === 1) {
      map.setCenter({ lat: drivers[0].latitude, lng: drivers[0].longitude });
      map.setZoom(14);
    } else {
      map.fitBounds(bounds, 50);
    }
  }, [map, drivers]);

  return null;
}

function DeliveryMapInner() {
  const { styles: mapStyles, mapId, colorScheme } = useMapTheme();
  const [realtimeUpdates, setRealtimeUpdates] = useState<Map<string, DriverWithLocation>>(
    new Map(),
  );
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);

  const {
    data: initialDrivers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["driver-locations"],
    queryFn: fetchDriverLocations,
    refetchInterval: 30_000,
  });

  const { data: mapDefaults } = useQuery({
    queryKey: ["map-defaults"],
    queryFn: fetchMapDefaults,
    staleTime: 5 * 60 * 1000,
  });

  // Merge initial data with real-time updates
  const drivers = useMemo(() => {
    const map = new Map<string, DriverWithLocation>();
    for (const d of initialDrivers) {
      map.set(d.driver_id, d);
    }
    for (const [key, val] of realtimeUpdates) {
      map.set(key, val);
    }
    return map;
  }, [initialDrivers, realtimeUpdates]);

  const handleRealtimeInsert = useCallback((location: DriverLocation) => {
    setRealtimeUpdates((prev) => {
      const next = new Map(prev);
      const existing = next.get(location.driver_id);
      next.set(location.driver_id, {
        driver_id: location.driver_id,
        username: existing?.username ?? "Driver",
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        recorded_at: location.recorded_at,
      });
      return next;
    });
  }, []);

  useRealtimeInserts<DriverLocation>("driver_locations", handleRealtimeInsert);

  const driverList = Array.from(drivers.values());
  const center =
    driverList.length > 0
      ? { lat: driverList[0].latitude, lng: driverList[0].longitude }
      : {
          lat: mapDefaults?.default_latitude ?? 40.7128,
          lng: mapDefaults?.default_longitude ?? -74.006,
        };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-[calc(100dvh-12rem)] w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">Failed to load driver locations</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Delivery Map</h2>
          <p className="text-sm text-muted-foreground">Real-time driver positions</p>
        </div>
        <Badge variant="secondary">{driverList.length} active</Badge>
      </div>

      {driverList.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No active drivers</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <GoogleMap
            className="h-[calc(100dvh-12rem)] w-full"
            defaultCenter={center}
            defaultZoom={12}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId={mapId}
            colorScheme={colorScheme}
            styles={mapStyles}
          >
            <FitDriverBounds drivers={driverList} />

            {driverList.map((driver) => (
              <AdvancedMarker
                key={driver.driver_id}
                position={{ lat: driver.latitude, lng: driver.longitude }}
                title={driver.username}
                onClick={() => setSelectedDriver(driver.driver_id)}
              >
                <DriverMarker
                  username={driver.username}
                  speed={driver.speed}
                  heading={driver.heading}
                  isSelected={selectedDriver === driver.driver_id}
                />
              </AdvancedMarker>
            ))}

            {selectedDriver &&
              drivers.has(selectedDriver) &&
              (() => {
                const driver = drivers.get(selectedDriver)!;
                return (
                  <InfoWindow
                    position={{ lat: driver.latitude, lng: driver.longitude }}
                    onCloseClick={() => setSelectedDriver(null)}
                  >
                    <div className="space-y-1 text-gray-900">
                      <p className="font-medium">{driver.username}</p>
                      {driver.speed !== null && (
                        <p className="text-xs text-gray-700">
                          {Math.round(driver.speed * 3.6)} km/h
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Last seen: {new Date(driver.recorded_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </InfoWindow>
                );
              })()}
          </GoogleMap>
        </div>
      )}

      {/* Driver list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Active Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          {driverList.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active drivers</p>
          ) : (
            <div className="space-y-2">
              {driverList.map((driver) => (
                <div
                  key={driver.driver_id}
                  className="flex items-center justify-between rounded-lg border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{driver.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                    </p>
                  </div>
                  <div className="size-2 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DeliveryMap() {
  return (
    <GoogleMapsProvider>
      <DeliveryMapInner />
    </GoogleMapsProvider>
  );
}
