import { useSyncExternalStore } from "react";

// ────────────────────────────────────────────────────────────
// GPS Store — lightweight reactive store (no external deps)
// ────────────────────────────────────────────────────────────

export type GpsStatus = "active" | "searching" | "error" | "denied" | "unavailable";

export interface GpsState {
  status: GpsStatus;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  lastUpdate: number | null;
}

const INITIAL_STATE: GpsState = {
  status: "searching",
  latitude: null,
  longitude: null,
  accuracy: null,
  heading: null,
  speed: null,
  lastUpdate: null,
};

let state: GpsState = { ...INITIAL_STATE };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): GpsState {
  return state;
}

function getServerSnapshot(): GpsState {
  return INITIAL_STATE;
}

// ────────────────────────────────────────────────────────────
// Actions (called by GPSTracker)
// ────────────────────────────────────────────────────────────

export function gpsActions() {
  return {
    setPosition(position: GeolocationPosition) {
      state = {
        status: "active",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed,
        lastUpdate: Date.now(),
      };
      notify();
    },

    setError(error: GeolocationPositionError) {
      state = {
        ...state,
        status: error.code === error.PERMISSION_DENIED ? "denied" : "error",
      };
      notify();
    },

    setSearching() {
      state = { ...state, status: "searching" };
      notify();
    },

    setUnavailable() {
      state = { ...state, status: "unavailable" };
      notify();
    },
  };
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export function useGpsStore(): GpsState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
