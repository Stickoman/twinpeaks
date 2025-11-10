// ────────────────────────────────────────────────────────────
// TSP Route Optimizer with OSRM support
// ────────────────────────────────────────────────────────────

interface Coordinate {
  latitude: number;
  longitude: number;
}

interface OrderPoint extends Coordinate {
  id: string;
  address: string;
}

interface OptimizedRoute {
  order: OrderPoint[];
  total_distance_km: number;
  source: "osrm" | "nearest_neighbor";
}

const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 5000;

// ────────────────────────────────────────────────────────────
// Haversine distance (km)
// ────────────────────────────────────────────────────────────

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ────────────────────────────────────────────────────────────
// OSRM Trip API (TSP solver)
// ────────────────────────────────────────────────────────────

interface OsrmTrip {
  trips: { distance: number; legs: { distance: number }[] }[];
  waypoints: { waypoint_index: number; trips_index: number }[];
}

async function osrmTrip(start: Coordinate, points: OrderPoint[]): Promise<OptimizedRoute | null> {
  if (points.length === 0) return null;

  const allCoords = [start, ...points];
  const coordString = allCoords.map((c) => `${c.longitude},${c.latitude}`).join(";");

  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordString}?source=first&roundtrip=false`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as OsrmTrip;

    if (!data.trips || data.trips.length === 0) return null;

    // Reorder points according to OSRM waypoint indices
    // waypoints[0] is the start point, skip it
    const waypointOrder = data.waypoints
      .slice(1)
      .sort((a, b) => a.waypoint_index - b.waypoint_index);

    const orderedPoints = waypointOrder.map((wp) => points[wp.waypoint_index - 1]);

    return {
      order: orderedPoints,
      total_distance_km: data.trips[0].distance / 1000,
      source: "osrm",
    };
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// Nearest-neighbor fallback
// ────────────────────────────────────────────────────────────

function nearestNeighbor(start: Coordinate, points: OrderPoint[]): OptimizedRoute {
  const result: OrderPoint[] = [];
  const remaining = [...points];
  let current = start;
  let totalDist = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const dist = haversineDistance(
        current.latitude,
        current.longitude,
        remaining[i].latitude,
        remaining[i].longitude,
      );
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0];
    result.push(nearest);
    totalDist += nearestDist;
    current = nearest;
  }

  return {
    order: result,
    total_distance_km: totalDist,
    source: "nearest_neighbor",
  };
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

/**
 * Optimize a delivery route using OSRM when available,
 * falling back to nearest-neighbor algorithm.
 */
export async function optimizeDeliveryRoute(
  start: Coordinate,
  orders: OrderPoint[],
): Promise<OptimizedRoute> {
  // Separate orders with/without coordinates
  const withCoords = orders.filter((o) => o.latitude !== null && o.longitude !== null);
  const withoutCoords = orders.filter((o) => o.latitude === null || o.longitude === null);

  if (withCoords.length === 0) {
    return { order: orders, total_distance_km: 0, source: "nearest_neighbor" };
  }

  // Try OSRM first
  const osrmResult = await osrmTrip(start, withCoords);

  if (osrmResult) {
    return {
      ...osrmResult,
      order: [...osrmResult.order, ...withoutCoords],
    };
  }

  // Fallback to nearest-neighbor
  const nnResult = nearestNeighbor(start, withCoords);
  return {
    ...nnResult,
    order: [...nnResult.order, ...withoutCoords],
  };
}

// ────────────────────────────────────────────────────────────
// Google Directions — real road polylines + ETAs
// ────────────────────────────────────────────────────────────

import { getGoogleDirections, type DirectionsResult } from "./directions";

export interface RouteWithPolylines {
  optimized_order: OrderPoint[];
  polyline: string;
  legs: {
    distance_m: number;
    duration_seconds: number;
    start_address: string;
    end_address: string;
  }[];
  total_distance_m: number;
  total_duration_seconds: number;
  source: "osrm" | "nearest_neighbor";
}

/**
 * After OSRM optimization, fetch Google Directions for real
 * road polylines and accurate ETAs per leg.
 */
export async function getRoutePolylines(
  start: Coordinate,
  optimizedOrder: OrderPoint[],
  source: "osrm" | "nearest_neighbor",
): Promise<RouteWithPolylines | null> {
  if (optimizedOrder.length === 0) return null;

  const origin = { lat: start.latitude, lng: start.longitude };
  const destination = {
    lat: optimizedOrder[optimizedOrder.length - 1].latitude,
    lng: optimizedOrder[optimizedOrder.length - 1].longitude,
  };

  // Intermediate waypoints (all except the last, which is the destination)
  const waypoints =
    optimizedOrder.length > 1
      ? optimizedOrder.slice(0, -1).map((o) => ({ lat: o.latitude, lng: o.longitude }))
      : undefined;

  const directions: DirectionsResult | null = await getGoogleDirections(
    origin,
    destination,
    waypoints,
  );

  if (!directions) return null;

  return {
    optimized_order: optimizedOrder,
    polyline: directions.polyline,
    legs: directions.legs,
    total_distance_m: directions.total_distance_m,
    total_duration_seconds: directions.total_duration_seconds,
    source,
  };
}
