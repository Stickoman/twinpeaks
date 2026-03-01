import { describe, it, expect } from "vitest";
import {
  ITEM_CATEGORIES,
  ORDER_STATUSES,
  UNITS,
  ROLES,
  TOKEN_TTL_MINUTES,
  MAX_ACCESS_ATTEMPTS,
} from "../constants";

// ---------------------------------------------------------------------------
// ITEM_CATEGORIES
// ---------------------------------------------------------------------------

describe("ITEM_CATEGORIES", () => {
  it("has at least one entry", () => {
    expect(ITEM_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("each entry has value and label strings", () => {
    for (const cat of ITEM_CATEGORIES) {
      expect(typeof cat.value).toBe("string");
      expect(typeof cat.label).toBe("string");
      expect(cat.value.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it("has unique values", () => {
    const values = ITEM_CATEGORIES.map((c) => c.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

// ---------------------------------------------------------------------------
// ORDER_STATUSES
// ---------------------------------------------------------------------------

describe("ORDER_STATUSES", () => {
  it("contains all expected statuses", () => {
    const values = ORDER_STATUSES.map((s) => s.value);
    expect(values).toContain("pending");
    expect(values).toContain("assigned");
    expect(values).toContain("en_route");
    expect(values).toContain("delivered");
    expect(values).toContain("cancelled");
  });

  it("has unique values", () => {
    const values = ORDER_STATUSES.map((s) => s.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("each entry has value and label strings", () => {
    for (const status of ORDER_STATUSES) {
      expect(typeof status.value).toBe("string");
      expect(typeof status.label).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// UNITS
// ---------------------------------------------------------------------------

describe("UNITS", () => {
  it("includes gram as first entry", () => {
    expect(UNITS[0].value).toBe("g");
    expect(UNITS[0].label).toBe("Gram");
  });

  it("has unique values", () => {
    const values = UNITS.map((u) => u.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("each entry has value and label", () => {
    for (const unit of UNITS) {
      expect(typeof unit.value).toBe("string");
      expect(typeof unit.label).toBe("string");
      expect(unit.value.length).toBeGreaterThan(0);
    }
  });

  it("contains common weight units", () => {
    const values = UNITS.map((u) => u.value);
    expect(values).toContain("g");
    expect(values).toContain("ounce");
    expect(values).toContain("pound");
  });
});

// ---------------------------------------------------------------------------
// ROLES
// ---------------------------------------------------------------------------

describe("ROLES", () => {
  it("contains admin, super_admin, and god_admin", () => {
    const values = ROLES.map((r) => r.value);
    expect(values).toContain("admin");
    expect(values).toContain("super_admin");
    expect(values).toContain("god_admin");
  });

  it("has unique values", () => {
    const values = ROLES.map((r) => r.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("each role has permissions array", () => {
    for (const role of ROLES) {
      expect(Array.isArray(role.permissions)).toBe(true);
      expect(role.permissions.length).toBeGreaterThan(0);
    }
  });

  it("god_admin has the most permissions", () => {
    const god = ROLES.find((r) => r.value === "god_admin");
    const admin = ROLES.find((r) => r.value === "admin");
    expect(god!.permissions.length).toBeGreaterThan(admin!.permissions.length);
  });

  it("all roles have read and write", () => {
    for (const role of ROLES) {
      expect(role.permissions).toContain("read");
      expect(role.permissions).toContain("write");
    }
  });
});

// ---------------------------------------------------------------------------
// Token/Auth constants
// ---------------------------------------------------------------------------

describe("Token constants", () => {
  it("TOKEN_TTL_MINUTES is a positive number", () => {
    expect(TOKEN_TTL_MINUTES).toBeGreaterThan(0);
    expect(Number.isInteger(TOKEN_TTL_MINUTES)).toBe(true);
  });

  it("MAX_ACCESS_ATTEMPTS is a positive number", () => {
    expect(MAX_ACCESS_ATTEMPTS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_ACCESS_ATTEMPTS)).toBe(true);
  });
});
