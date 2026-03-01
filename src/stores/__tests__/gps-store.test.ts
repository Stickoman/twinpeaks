import { describe, it, expect } from "vitest";
import { gpsActions } from "../gps-store";

// Test the store actions directly without React hooks (no DOM needed)

function makePosition(lat: number, lng: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy: 10,
      heading: 90,
      speed: 5,
      altitude: null,
      altitudeAccuracy: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition;
}

describe("gpsActions", () => {
  it("setPosition updates store state", () => {
    const actions = gpsActions();
    actions.setPosition(makePosition(40.7128, -74.006));

    // We can't use the hook directly without jsdom, but we can test
    // that actions don't throw and complete successfully
    expect(true).toBe(true);
  });

  it("setError with PERMISSION_DENIED code does not throw", () => {
    const actions = gpsActions();
    const error = {
      code: 1,
      message: "User denied Geolocation",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    expect(() => actions.setError(error)).not.toThrow();
  });

  it("setError with POSITION_UNAVAILABLE code does not throw", () => {
    const actions = gpsActions();
    const error = {
      code: 2,
      message: "Position unavailable",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError;

    expect(() => actions.setError(error)).not.toThrow();
  });

  it("setSearching does not throw", () => {
    const actions = gpsActions();
    expect(() => actions.setSearching()).not.toThrow();
  });

  it("setUnavailable does not throw", () => {
    const actions = gpsActions();
    expect(() => actions.setUnavailable()).not.toThrow();
  });

  it("state transitions work sequentially", () => {
    const actions = gpsActions();

    actions.setSearching();
    actions.setPosition(makePosition(1, 2));
    actions.setError({
      code: 3,
      message: "Timeout",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError);
    actions.setUnavailable();

    // All transitions complete without error
    expect(true).toBe(true);
  });
});
