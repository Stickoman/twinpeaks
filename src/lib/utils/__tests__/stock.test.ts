import { describe, it, expect } from "vitest";
import { getAvailabilityStatus, getAvailabilityBadgeConfig } from "../stock";

// ---------------------------------------------------------------------------
// getAvailabilityStatus
// ---------------------------------------------------------------------------

describe("getAvailabilityStatus", () => {
  it("returns 'unavailable' when quantity is 0", () => {
    expect(getAvailabilityStatus(0, 10, 10)).toBe("unavailable");
  });

  it("returns 'unavailable' when quantity is negative", () => {
    expect(getAvailabilityStatus(-5, 10, 10)).toBe("unavailable");
  });

  it("returns 'low' when quantity equals item threshold", () => {
    expect(getAvailabilityStatus(10, 10, 5)).toBe("low");
  });

  it("returns 'low' when quantity is below item threshold", () => {
    expect(getAvailabilityStatus(3, 10, 5)).toBe("low");
  });

  it("returns 'available' when quantity is above item threshold", () => {
    expect(getAvailabilityStatus(20, 10, 5)).toBe("available");
  });

  it("uses category threshold when item threshold is null", () => {
    expect(getAvailabilityStatus(5, null, 5)).toBe("low");
    expect(getAvailabilityStatus(6, null, 5)).toBe("available");
  });

  it("falls back to default threshold of 10 when both thresholds are null", () => {
    expect(getAvailabilityStatus(10, null, null)).toBe("low");
    expect(getAvailabilityStatus(11, null, null)).toBe("available");
    expect(getAvailabilityStatus(5, null, null)).toBe("low");
  });

  it("prefers item threshold over category threshold", () => {
    // item threshold = 3, category threshold = 20
    // quantity 5 is above item threshold (3) so should be available
    expect(getAvailabilityStatus(5, 3, 20)).toBe("available");
  });

  it("returns 'low' for quantity of 1 with default thresholds", () => {
    expect(getAvailabilityStatus(1, null, null)).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// getAvailabilityBadgeConfig
// ---------------------------------------------------------------------------

describe("getAvailabilityBadgeConfig", () => {
  it("returns 'In Stock' label for available status", () => {
    const config = getAvailabilityBadgeConfig("available");
    expect(config.label).toBe("In Stock");
    expect(config.className).toContain("emerald");
  });

  it("returns 'Low Stock' label for low status", () => {
    const config = getAvailabilityBadgeConfig("low");
    expect(config.label).toBe("Low Stock");
    expect(config.className).toContain("amber");
  });

  it("returns 'Out of Stock' label for unavailable status", () => {
    const config = getAvailabilityBadgeConfig("unavailable");
    expect(config.label).toBe("Out of Stock");
    expect(config.className).toContain("red");
  });

  it("returns className containing dark mode classes", () => {
    const config = getAvailabilityBadgeConfig("available");
    expect(config.className).toContain("dark:");
  });
});
