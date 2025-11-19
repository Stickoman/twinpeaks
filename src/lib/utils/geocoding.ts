// ────────────────────────────────────────────────────────────
// Google Maps Geocoding service (server-side)
// ────────────────────────────────────────────────────────────

const GOOGLE_MAPS_KEY = () => process.env.GOOGLE_MAPS_SERVER_KEY ?? "";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results: {
    geometry: { location: { lat: number; lng: number } };
    formatted_address: string;
  }[];
}

/**
 * Forward geocode: address string → coordinates + formatted address.
 */
export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY()}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK" || data.results.length === 0) return null;

  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formatted_address: result.formatted_address,
  };
}

/**
 * Reverse geocode: coordinates → readable address string.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY()}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as GoogleGeocodeResponse;
  if (data.status !== "OK" || data.results.length === 0) return null;

  return data.results[0].formatted_address;
}

/**
 * Batch geocode multiple addresses in parallel.
 */
export async function batchGeocode(addresses: string[]): Promise<(GeocodingResult | null)[]> {
  return Promise.all(addresses.map(geocodeAddress));
}
