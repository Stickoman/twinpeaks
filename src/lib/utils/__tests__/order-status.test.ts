import { describe, it, expect } from "vitest";
import { ORDER_STATUS_CONFIG, getRoleLabel } from "../order-status";
import type { OrderStatus } from "@/types/database";

// ---------------------------------------------------------------------------
// ORDER_STATUS_CONFIG — completeness
// ---------------------------------------------------------------------------

describe("ORDER_STATUS_CONFIG", () => {
  const expectedStatuses: OrderStatus[] = [
    "pending",
    "assigned",
    "en_route",
    "delivered",
    "cancelled",
  ];

  it("has exactly 5 statuses", () => {
    expect(Object.keys(ORDER_STATUS_CONFIG)).toHaveLength(5);
  });

  it("contains all expected statuses", () => {
    for (const status of expectedStatuses) {
      expect(ORDER_STATUS_CONFIG).toHaveProperty(status);
    }
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUS_CONFIG — structure of each status
// ---------------------------------------------------------------------------

describe("ORDER_STATUS_CONFIG — status structure", () => {
  const requiredKeys = ["label", "icon", "badgeClass", "cardClass", "color"];

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has all required keys", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    for (const key of requiredKeys) {
      expect(config).toHaveProperty(key);
    }
  });

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has a non-empty label", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    expect(typeof config.label).toBe("string");
    expect(config.label.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has a valid icon component", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    expect(["function", "object"]).toContain(typeof config.icon);
  });

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has a non-empty badgeClass", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    expect(typeof config.badgeClass).toBe("string");
    expect(config.badgeClass.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has a non-empty cardClass", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    expect(typeof config.cardClass).toBe("string");
    expect(config.cardClass.length).toBeGreaterThan(0);
  });

  it.each(Object.keys(ORDER_STATUS_CONFIG))("status '%s' has a valid hex color", (status) => {
    const config = ORDER_STATUS_CONFIG[status as OrderStatus];
    expect(config.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUS_CONFIG — specific labels
// ---------------------------------------------------------------------------

describe("ORDER_STATUS_CONFIG — labels", () => {
  it('pending has label "Pending"', () => {
    expect(ORDER_STATUS_CONFIG.pending.label).toBe("Pending");
  });

  it('assigned has label "Assigned"', () => {
    expect(ORDER_STATUS_CONFIG.assigned.label).toBe("Assigned");
  });

  it('en_route has label "In Transit"', () => {
    expect(ORDER_STATUS_CONFIG.en_route.label).toBe("In Transit");
  });

  it('delivered has label "Delivered"', () => {
    expect(ORDER_STATUS_CONFIG.delivered.label).toBe("Delivered");
  });

  it('cancelled has label "Cancelled"', () => {
    expect(ORDER_STATUS_CONFIG.cancelled.label).toBe("Cancelled");
  });
});

// ---------------------------------------------------------------------------
// getRoleLabel
// ---------------------------------------------------------------------------

describe("getRoleLabel", () => {
  it('returns "God Admin" for god_admin', () => {
    expect(getRoleLabel("god_admin")).toBe("God Admin");
  });

  it('returns "Super Admin" for super_admin', () => {
    expect(getRoleLabel("super_admin")).toBe("Super Admin");
  });

  it('returns "Admin" for admin', () => {
    expect(getRoleLabel("admin")).toBe("Admin");
  });

  it("returns the raw value for an unknown role", () => {
    expect(getRoleLabel("unknown_role")).toBe("unknown_role");
  });

  it("returns the raw value for driver role", () => {
    expect(getRoleLabel("driver")).toBe("driver");
  });

  it("returns empty string for empty string input", () => {
    expect(getRoleLabel("")).toBe("");
  });
});
