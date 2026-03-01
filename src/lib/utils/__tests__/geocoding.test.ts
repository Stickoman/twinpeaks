import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { geocodeAddress, reverseGeocode, batchGeocode } from "../geocoding";

// Mock env
beforeEach(() => {
  vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("geocodeAddress", () => {
  it("returns coordinates for valid address", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 40.7128, lng: -74.006 } },
                formatted_address: "New York, NY, USA",
              },
            ],
          }),
      }),
    );

    const result = await geocodeAddress("New York");
    expect(result).toEqual({
      lat: 40.7128,
      lng: -74.006,
      formatted_address: "New York, NY, USA",
    });
  });

  it("returns null for no results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
      }),
    );

    const result = await geocodeAddress("nonexistent place xyz");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await geocodeAddress("New York");
    expect(result).toBeNull();
  });

  it("includes API key in request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await geocodeAddress("test");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("key=test-key"));
  });
});

describe("reverseGeocode", () => {
  it("returns address string for valid coords", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OK",
            results: [
              {
                geometry: { location: { lat: 40.7128, lng: -74.006 } },
                formatted_address: "123 Broadway, New York, NY 10006, USA",
              },
            ],
          }),
      }),
    );

    const result = await reverseGeocode(40.7128, -74.006);
    expect(result).toBe("123 Broadway, New York, NY 10006, USA");
  });

  it("returns null on failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const result = await reverseGeocode(0, 0);
    expect(result).toBeNull();
  });
});

describe("batchGeocode", () => {
  it("geocodes multiple addresses in parallel", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "OK",
              results: [
                {
                  geometry: { location: { lat: callCount, lng: callCount } },
                  formatted_address: `Address ${callCount}`,
                },
              ],
            }),
        });
      }),
    );

    const results = await batchGeocode(["addr1", "addr2", "addr3"]);
    expect(results).toHaveLength(3);
    expect(results[0]).not.toBeNull();
    expect(results[1]).not.toBeNull();
    expect(results[2]).not.toBeNull();
  });

  it("handles mixed successes and failures", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "OK",
              results: [
                {
                  geometry: { location: { lat: 1, lng: 1 } },
                  formatted_address: "Test",
                },
              ],
            }),
        });
      }),
    );

    const results = await batchGeocode(["ok1", "fail", "ok2"]);
    expect(results[0]).not.toBeNull();
    expect(results[1]).toBeNull();
    expect(results[2]).not.toBeNull();
  });
});
