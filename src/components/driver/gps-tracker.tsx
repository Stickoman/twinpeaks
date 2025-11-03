"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import { gpsActions } from "@/stores/gps-store";

const UPDATE_INTERVAL_MS = 15_000;
const MIN_DISTANCE_M = 50;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function GPSTracker() {
  const lastSent = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const watchId = useRef<number | null>(null);
  const failedQueue = useRef<GeolocationPosition[]>([]);
  // Memoize to keep a stable reference across renders
  const actions = useMemo(() => gpsActions(), []);

  const sendLocation = useCallback(
    async (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, heading, speed } = position.coords;
      const now = Date.now();

      // Update GPS store with every position
      actions.setPosition(position);

      // Throttle server updates: only send if enough time OR distance has passed
      if (lastSent.current) {
        const timeDiff = now - lastSent.current.time;
        const distance = haversineDistance(
          lastSent.current.lat,
          lastSent.current.lng,
          latitude,
          longitude,
        );

        if (timeDiff < UPDATE_INTERVAL_MS && distance < MIN_DISTANCE_M) {
          return;
        }
      }

      lastSent.current = { lat: latitude, lng: longitude, time: now };

      try {
        await fetch("/api/driver/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude,
            longitude,
            accuracy: accuracy ?? undefined,
            heading: heading ?? undefined,
            speed: speed ?? undefined,
          }),
        });

        // Flush any queued updates after successful send
        failedQueue.current = [];
      } catch {
        // Queue failed updates for retry
        if (failedQueue.current.length < 10) {
          failedQueue.current.push(position);
        }
      }
    },
    [actions],
  );

  const handleError = useCallback(
    (error: GeolocationPositionError) => {
      actions.setError(error);
    },
    [actions],
  );

  useEffect(() => {
    if (!navigator.geolocation) {
      actions.setUnavailable();
      return;
    }

    actions.setSearching();

    watchId.current = navigator.geolocation.watchPosition(sendLocation, handleError, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 30_000,
    });

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [sendLocation, handleError, actions]);

  // This component renders nothing — it's a background service
  return null;
}
