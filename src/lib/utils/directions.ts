// ────────────────────────────────────────────────────────────
// Google Maps Directions service (server-side)
// ────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY ?? "";
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface DirectionsLeg {
  distance_m: number;
  duration_seconds: number;
  start_address: string;
  end_address: string;
}

export interface DirectionsResult {
  polyline: string; // Encoded polyline for the full route
  legs: DirectionsLeg[];
  total_distance_m: number;
  total_duration_seconds: number;
}

interface GoogleDirectionsResponse {
  status: string;
  routes: {
    overview_polyline: { points: string };
    legs: {
      distance: { value: number };
      duration: { value: number };
      start_address: string;
      end_address: string;
    }[];
  }[];
}

/**
 * Get driving directions with real road polylines.
 * Supports up to 25 waypoints (Google API limit).
 */
export async function getGoogleDirections(
  origin: LatLng,
  destination: LatLng,
  waypoints?: LatLng[],
): Promise<DirectionsResult | null> {
  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    key: GOOGLE_MAPS_KEY(),
  });

  if (waypoints && waypoints.length > 0) {
    const waypointStr = waypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|");
    params.set("waypoints", waypointStr);
  }

  const response = await fetch(`${DIRECTIONS_URL}?${params.toString()}`);
  if (!response.ok) return null;

  const data = (await response.json()) as GoogleDirectionsResponse;
  if (data.status !== "OK" || data.routes.length === 0) return null;

  const route = data.routes[0];
  const legs: DirectionsLeg[] = route.legs.map((leg) => ({
    distance_m: leg.distance.value,
    duration_seconds: leg.duration.value,
    start_address: leg.start_address,
    end_address: leg.end_address,
  }));

  return {
    polyline: route.overview_polyline.points,
    legs,
    total_distance_m: legs.reduce((sum, l) => sum + l.distance_m, 0),
    total_duration_seconds: legs.reduce((sum, l) => sum + l.duration_seconds, 0),
  };
}
