import { describe, it, expect } from "vitest";
import { haversineDistanceMiles, haversineDistanceKm, getDeliveryFee } from "../geo";
import type { DeliveryFeeTier } from "@/types/database";

// ---------------------------------------------------------------------------
// haversineDistanceMiles
// ---------------------------------------------------------------------------

describe("haversineDistanceMiles", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceMiles(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates NYC to LA (~2,451 miles)", () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeGreaterThan(2400);
    expect(distance).toBeLessThan(2500);
  });

  it("returns ~2446 miles from NYC to LA (toBeCloseTo precision 0)", () => {
    const distance = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeCloseTo(2446, 0);
  });

  it("is exactly km / 1.60934 for a known pair", () => {
    const km = haversineDistanceKm(40.7128, -74.006, 34.0522, -118.2437);
    const miles = haversineDistanceMiles(40.7128, -74.006, 34.0522, -118.2437);
    expect(miles).toBeCloseTo(km / 1.60934, 6);
  });

  it("calculates short distance (~10 miles)", () => {
    // JFK to Manhattan (~12 miles)
    const distance = haversineDistanceMiles(40.6413, -73.7781, 40.7128, -74.006);
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(20);
  });
});

// ---------------------------------------------------------------------------
// haversineDistanceKm
// ---------------------------------------------------------------------------

describe("haversineDistanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(haversineDistanceKm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it("returns ~3936 km from NYC to LA (toBeCloseTo precision 0)", () => {
    const distance = haversineDistanceKm(40.7128, -74.006, 34.0522, -118.2437);
    expect(distance).toBeCloseTo(3936, 0);
  });

  it("calculates Paris to London (~340 km)", () => {
    const distance = haversineDistanceKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(330);
    expect(distance).toBeLessThan(350);
  });

  it("returns a short distance for two points ~1 km apart", () => {
    // Moving ~0.009° north at the equator ≈ 1 km
    const distance = haversineDistanceKm(0, 0, 0.009, 0);
    expect(distance).toBeGreaterThan(0.9);
    expect(distance).toBeLessThan(1.1);
  });

  it("is symmetric (A→B == B→A)", () => {
    const ab = haversineDistanceKm(40.7128, -74.006, 34.0522, -118.2437);
    const ba = haversineDistanceKm(34.0522, -118.2437, 40.7128, -74.006);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

// ---------------------------------------------------------------------------
// getDeliveryFee
// ---------------------------------------------------------------------------

describe("getDeliveryFee", () => {
  const tiers: DeliveryFeeTier[] = [
    { min_miles: 0, max_miles: 10, fee: 0 },
    { min_miles: 10, max_miles: 20, fee: 10 },
    { min_miles: 20, max_miles: 30, fee: 20 },
  ];

  it("returns $0 for distance within first tier", () => {
    expect(getDeliveryFee(5, tiers)).toBe(0);
  });

  it("returns $10 for distance in second tier", () => {
    expect(getDeliveryFee(15, tiers)).toBe(10);
  });

  it("returns $20 for distance in third tier", () => {
    expect(getDeliveryFee(25, tiers)).toBe(20);
  });

  it("returns null for distance beyond all tiers", () => {
    expect(getDeliveryFee(35, tiers)).toBeNull();
  });

  it("returns $0 for distance at exactly 0", () => {
    expect(getDeliveryFee(0, tiers)).toBe(0);
  });

  it("returns $10 for distance at exactly 10 (boundary)", () => {
    expect(getDeliveryFee(10, tiers)).toBe(10);
  });

  it("returns null for distance at exactly 30 (boundary)", () => {
    expect(getDeliveryFee(30, tiers)).toBeNull();
  });

  it("handles unsorted tiers", () => {
    const unsorted: DeliveryFeeTier[] = [
      { min_miles: 20, max_miles: 30, fee: 20 },
      { min_miles: 0, max_miles: 10, fee: 0 },
      { min_miles: 10, max_miles: 20, fee: 10 },
    ];
    expect(getDeliveryFee(5, unsorted)).toBe(0);
    expect(getDeliveryFee(15, unsorted)).toBe(10);
  });

  it("returns null for empty tiers", () => {
    expect(getDeliveryFee(5, [])).toBeNull();
  });
});
