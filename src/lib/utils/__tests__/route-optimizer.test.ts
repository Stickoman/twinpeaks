import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { haversineDistance, optimizeDeliveryRoute, getRoutePolylines } from "../route-optimizer";

// ---------------------------------------------------------------------------
// haversineDistance
// ---------------------------------------------------------------------------

describe("haversineDistance", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistance(40.7128, -74.006, 40.7128, -74.006)).toBe(0);
  });

  it("calculates correct distance between NYC and LA", () => {
    // NYC to LA is roughly 3944 km
    const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3900);
    expect(dist).toBeLessThan(4000);
  });

  it("handles negative coordinates", () => {
    const dist = haversineDistance(-33.8688, 151.2093, -37.8136, 144.9631);
    expect(dist).toBeGreaterThan(700);
    expect(dist).toBeLessThan(800);
  });
});

// ---------------------------------------------------------------------------
// optimizeDeliveryRoute
// ---------------------------------------------------------------------------

describe("optimizeDeliveryRoute", () => {
  // Mock OSRM to always fail so we test nearest-neighbor
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns empty result for no orders", async () => {
    const result = await optimizeDeliveryRoute({ latitude: 40.7128, longitude: -74.006 }, []);
    expect(result.order).toHaveLength(0);
    expect(result.source).toBe("nearest_neighbor");
  });

  it("returns single order unchanged", async () => {
    const orders = [{ id: "o1", address: "123 Main St", latitude: 40.73, longitude: -73.99 }];
    const result = await optimizeDeliveryRoute({ latitude: 40.7128, longitude: -74.006 }, orders);
    expect(result.order).toHaveLength(1);
    expect(result.order[0].id).toBe("o1");
  });

  it("optimizes multi-order route by nearest neighbor", async () => {
    const start = { latitude: 40.7128, longitude: -74.006 };
    const orders = [
      { id: "far", address: "Far", latitude: 41.0, longitude: -74.0 },
      { id: "near", address: "Near", latitude: 40.72, longitude: -74.0 },
      { id: "mid", address: "Mid", latitude: 40.8, longitude: -74.0 },
    ];

    const result = await optimizeDeliveryRoute(start, orders);
    expect(result.order).toHaveLength(3);
    // Nearest to start should be first
    expect(result.order[0].id).toBe("near");
    expect(result.source).toBe("nearest_neighbor");
  });

  it("appends orders without coordinates at the end", async () => {
    const start = { latitude: 40.7128, longitude: -74.006 };
    const orders = [
      { id: "geo", address: "Geo", latitude: 40.72, longitude: -74.0 },
      {
        id: "nogeo",
        address: "NoGeo",
        latitude: null as unknown as number,
        longitude: null as unknown as number,
      },
    ];

    const result = await optimizeDeliveryRoute(start, orders);
    expect(result.order).toHaveLength(2);
    expect(result.order[result.order.length - 1].id).toBe("nogeo");
  });

  it("reports total distance", async () => {
    const start = { latitude: 40.7128, longitude: -74.006 };
    const orders = [
      { id: "o1", address: "A", latitude: 40.72, longitude: -74.0 },
      { id: "o2", address: "B", latitude: 40.73, longitude: -73.99 },
    ];

    const result = await optimizeDeliveryRoute(start, orders);
    expect(result.total_distance_km).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getRoutePolylines
// ---------------------------------------------------------------------------

describe("getRoutePolylines", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns polyline and legs from Google Directions", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            routes: [
              {
                overview_polyline: { points: "encodedPolyline123" },
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 600 },
                    start_address: "A",
                    end_address: "B",
                  },
                ],
              },
            ],
          }),
      }),
    );

    const result = await getRoutePolylines(
      { latitude: 40.7, longitude: -74 },
      [{ id: "o1", address: "Dest", latitude: 40.8, longitude: -73.9 }],
      "osrm",
    );

    expect(result).not.toBeNull();
    expect(result!.polyline).toBe("encodedPolyline123");
    expect(result!.source).toBe("osrm");
    expect(result!.total_distance_m).toBe(5000);
    expect(result!.total_duration_seconds).toBe(600);
  });

  it("returns null for empty order list", async () => {
    const result = await getRoutePolylines({ latitude: 40.7, longitude: -74 }, [], "osrm");
    expect(result).toBeNull();
  });

  it("returns null when Google Directions fails", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await getRoutePolylines(
      { latitude: 40.7, longitude: -74 },
      [{ id: "o1", address: "Dest", latitude: 40.8, longitude: -73.9 }],
      "nearest_neighbor",
    );

    expect(result).toBeNull();
  });

  it("passes intermediate waypoints for multi-stop routes", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "OK",
          routes: [
            {
              overview_polyline: { points: "multi" },
              legs: [
                {
                  distance: { value: 2000 },
                  duration: { value: 200 },
                  start_address: "A",
                  end_address: "B",
                },
                {
                  distance: { value: 3000 },
                  duration: { value: 300 },
                  start_address: "B",
                  end_address: "C",
                },
              ],
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await getRoutePolylines(
      { latitude: 40.7, longitude: -74 },
      [
        { id: "o1", address: "Mid", latitude: 40.75, longitude: -73.95 },
        { id: "o2", address: "End", latitude: 40.8, longitude: -73.9 },
      ],
      "osrm",
    );

    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(2);
    // Should use o1 as waypoint, o2 as destination
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("waypoints=40.75");
  });
});
