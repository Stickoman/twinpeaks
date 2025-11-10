import type { DeliveryFeeTier } from "@/types/database";

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.60934;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine distance between two points in kilometers */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Haversine distance between two points in miles */
export function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  return haversineDistanceKm(lat1, lng1, lat2, lng2) / KM_PER_MILE;
}

/** Look up the delivery fee for a given distance in miles */
export function getDeliveryFee(distanceMiles: number, tiers: DeliveryFeeTier[]): number | null {
  const sorted = [...tiers].sort((a, b) => a.min_miles - b.min_miles);
  for (const tier of sorted) {
    if (distanceMiles >= tier.min_miles && distanceMiles < tier.max_miles) {
      return tier.fee;
    }
  }
  // Distance exceeds all tiers — out of range
  return null;
}
