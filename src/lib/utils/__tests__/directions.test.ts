import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getGoogleDirections } from "../directions";

beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("getGoogleDirections", () => {
  it("returns directions with polyline for simple route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            routes: [
              {
                overview_polyline: { points: "encodedPolylineString" },
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

    const result = await getGoogleDirections({ lat: 40.7, lng: -74 }, { lat: 40.8, lng: -73.9 });

    expect(result).not.toBeNull();
    expect(result!.polyline).toBe("encodedPolylineString");
    expect(result!.total_distance_m).toBe(5000);
    expect(result!.total_duration_seconds).toBe(600);
    expect(result!.legs).toHaveLength(1);
  });

  it("handles multi-waypoint route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            routes: [
              {
                overview_polyline: { points: "multiWaypointPolyline" },
                legs: [
                  {
                    distance: { value: 3000 },
                    duration: { value: 300 },
                    start_address: "A",
                    end_address: "B",
                  },
                  {
                    distance: { value: 4000 },
                    duration: { value: 400 },
                    start_address: "B",
                    end_address: "C",
                  },
                  {
                    distance: { value: 2000 },
                    duration: { value: 200 },
                    start_address: "C",
                    end_address: "D",
                  },
                ],
              },
            ],
          }),
      }),
    );

    const result = await getGoogleDirections({ lat: 40.7, lng: -74 }, { lat: 40.9, lng: -73.8 }, [
      { lat: 40.75, lng: -73.95 },
      { lat: 40.8, lng: -73.9 },
    ]);

    expect(result).not.toBeNull();
    expect(result!.legs).toHaveLength(3);
    expect(result!.total_distance_m).toBe(9000);
    expect(result!.total_duration_seconds).toBe(900);
  });

  it("includes waypoints in request URL", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          status: "OK",
          routes: [
            {
              overview_polyline: { points: "test" },
              legs: [
                {
                  distance: { value: 1000 },
                  duration: { value: 100 },
                  start_address: "A",
                  end_address: "B",
                },
              ],
            },
          ],
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getGoogleDirections({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }, [{ lat: 1.5, lng: 2.5 }]);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("waypoints=1.5%2C2.5");
  });

  it("returns null on API failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await getGoogleDirections({ lat: 40.7, lng: -74 }, { lat: 40.8, lng: -73.9 });
    expect(result).toBeNull();
  });

  it("returns null for no routes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "NOT_FOUND", routes: [] }),
      }),
    );

    const result = await getGoogleDirections({ lat: 0, lng: 0 }, { lat: 0, lng: 0 });
    expect(result).toBeNull();
  });
});
