import { describe, it, expect } from "vitest";
import {
  convertToGrams,
  convertFromGrams,
  convertUnits,
  checkStockAvailability,
  formatQuantityWithUnit,
  isValidUnit,
  getAvailableUnits,
  formatUnitLabel,
} from "../units";

// ---------------------------------------------------------------------------
// convertToGrams
// ---------------------------------------------------------------------------

describe("convertToGrams", () => {
  it("converts grams (identity)", () => {
    expect(convertToGrams(10, "g")).toBe(10);
  });

  it("converts 0.5g units", () => {
    expect(convertToGrams(4, "0.5g")).toBe(2);
  });

  it("converts ounces", () => {
    expect(convertToGrams(1, "ounce")).toBeCloseTo(28.3495, 3);
  });

  it("converts half ounce", () => {
    expect(convertToGrams(1, "half_ounce")).toBeCloseTo(14.17475, 3);
  });

  it("converts eighth (3.5g)", () => {
    expect(convertToGrams(1, "eighth")).toBeCloseTo(3.5437, 2);
  });

  it("converts quarter ounce", () => {
    expect(convertToGrams(1, "quarter_ounce")).toBeCloseTo(7.087375, 3);
  });

  it("converts pounds", () => {
    expect(convertToGrams(1, "pound")).toBeCloseTo(453.592, 2);
  });

  it("converts half pound", () => {
    expect(convertToGrams(1, "half_pound")).toBeCloseTo(226.796, 2);
  });

  it("converts quarter pound", () => {
    expect(convertToGrams(1, "quarter_pound")).toBeCloseTo(113.398, 2);
  });

  it("handles zero quantity", () => {
    expect(convertToGrams(0, "ounce")).toBe(0);
  });

  it("handles fractional quantity", () => {
    expect(convertToGrams(0.5, "g")).toBe(0.5);
  });

  it("throws on unknown unit", () => {
    expect(() => convertToGrams(1, "invalid")).toThrow("Unknown unit: invalid");
  });
});

// ---------------------------------------------------------------------------
// convertFromGrams
// ---------------------------------------------------------------------------

describe("convertFromGrams", () => {
  it("converts grams (identity)", () => {
    expect(convertFromGrams(10, "g")).toBe(10);
  });

  it("converts grams to ounces", () => {
    expect(convertFromGrams(28.3495, "ounce")).toBeCloseTo(1, 3);
  });

  it("converts grams to pounds", () => {
    expect(convertFromGrams(453.592, "pound")).toBeCloseTo(1, 3);
  });

  it("throws on unknown unit", () => {
    expect(() => convertFromGrams(1, "invalid")).toThrow("Unknown unit: invalid");
  });

  it("round-trips through grams", () => {
    const units = [
      "g",
      "0.5g",
      "eighth",
      "ounce",
      "half_ounce",
      "quarter_ounce",
      "pound",
      "half_pound",
      "quarter_pound",
    ] as const;
    for (const unit of units) {
      const grams = convertToGrams(5, unit);
      const back = convertFromGrams(grams, unit);
      expect(back).toBeCloseTo(5, 6);
    }
  });
});

// ---------------------------------------------------------------------------
// convertUnits
// ---------------------------------------------------------------------------

describe("convertUnits", () => {
  it("returns identity when units are the same", () => {
    expect(convertUnits(5, "pound", "pound")).toBe(5);
  });

  it("converts pound to half_pound", () => {
    expect(convertUnits(1, "pound", "half_pound")).toBeCloseTo(2, 6);
  });

  it("converts half_pound to pound", () => {
    expect(convertUnits(2, "half_pound", "pound")).toBeCloseTo(1, 6);
  });

  it("converts pound to ounce", () => {
    expect(convertUnits(1, "pound", "ounce")).toBeCloseTo(16, 0);
  });

  it("converts ounce to pound", () => {
    expect(convertUnits(16, "ounce", "pound")).toBeCloseTo(1, 4);
  });

  it("converts half_pound to ounce", () => {
    expect(convertUnits(1, "half_pound", "ounce")).toBeCloseTo(8, 0);
  });

  it("converts quarter_ounce to g", () => {
    expect(convertUnits(1, "quarter_ounce", "g")).toBeCloseTo(7.087, 2);
  });

  it("returns quantity unchanged for count units", () => {
    expect(convertUnits(5, "unit", "unit")).toBe(5);
    expect(convertUnits(3, "tab", "box")).toBe(3);
  });

  it("returns quantity unchanged for mixed weight/count", () => {
    expect(convertUnits(2, "pound", "unit")).toBe(2);
    expect(convertUnits(2, "tab", "ounce")).toBe(2);
  });

  it("round-trips across all weight units", () => {
    const units = [
      "g",
      "0.5g",
      "eighth",
      "ounce",
      "half_ounce",
      "quarter_ounce",
      "pound",
      "half_pound",
      "quarter_pound",
    ] as const;
    for (const from of units) {
      for (const to of units) {
        const result = convertUnits(convertUnits(1, from, to), to, from);
        expect(result).toBeCloseTo(1, 5);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// checkStockAvailability
// ---------------------------------------------------------------------------

describe("checkStockAvailability", () => {
  it("returns true when stock is sufficient", () => {
    expect(checkStockAvailability(100, 2, "g")).toBe(true);
  });

  it("returns true when stock exactly matches", () => {
    expect(checkStockAvailability(28.3495, 1, "ounce")).toBe(true);
  });

  it("returns false when stock is insufficient", () => {
    expect(checkStockAvailability(10, 1, "ounce")).toBe(false);
  });

  it("returns true for zero requested quantity", () => {
    expect(checkStockAvailability(0, 0, "g")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatQuantityWithUnit
// ---------------------------------------------------------------------------

describe("formatQuantityWithUnit", () => {
  it("formats gram quantity", () => {
    expect(formatQuantityWithUnit(10, "g")).toBe("10 g");
  });

  it("formats 0.5g quantity (multiplied)", () => {
    expect(formatQuantityWithUnit(3, "0.5g")).toBe("1.5 g");
  });

  it("formats ounce quantity", () => {
    expect(formatQuantityWithUnit(2, "ounce")).toBe("2 oz");
  });

  it("formats half_ounce quantity", () => {
    expect(formatQuantityWithUnit(1, "half_ounce")).toBe("0.5 oz");
  });

  it("formats eighth quantity", () => {
    expect(formatQuantityWithUnit(1, "eighth")).toBe("0.125 oz");
  });

  it("formats quarter_ounce quantity", () => {
    expect(formatQuantityWithUnit(1, "quarter_ounce")).toBe("0.25 oz");
  });

  it("formats pound quantity", () => {
    expect(formatQuantityWithUnit(3, "pound")).toBe("3 lb");
  });

  it("formats half_pound quantity", () => {
    expect(formatQuantityWithUnit(2, "half_pound")).toBe("1 lb");
  });

  it("formats quarter_pound quantity", () => {
    expect(formatQuantityWithUnit(1, "quarter_pound")).toBe("0.25 lb");
  });

  it("throws on unknown unit", () => {
    expect(() => formatQuantityWithUnit(1, "invalid")).toThrow("Unknown unit: invalid");
  });

  it("formats count unit singular", () => {
    expect(formatQuantityWithUnit(1, "tab")).toBe("1 tab");
  });

  it("formats count unit plural", () => {
    expect(formatQuantityWithUnit(3, "tab")).toBe("3 tabs");
  });

  it("formats box unit", () => {
    expect(formatQuantityWithUnit(2, "box")).toBe("2 boxes");
  });

  it("formats pack unit", () => {
    expect(formatQuantityWithUnit(1, "pack")).toBe("1 pack");
  });

  it("formats piece unit plural", () => {
    expect(formatQuantityWithUnit(5, "piece")).toBe("5 pieces");
  });
});

// ---------------------------------------------------------------------------
// isValidUnit
// ---------------------------------------------------------------------------

describe("isValidUnit", () => {
  it("accepts weight units", () => {
    expect(isValidUnit("g")).toBe(true);
    expect(isValidUnit("ounce")).toBe(true);
    expect(isValidUnit("pound")).toBe(true);
  });

  it("accepts count units", () => {
    expect(isValidUnit("unit")).toBe(true);
    expect(isValidUnit("tab")).toBe(true);
    expect(isValidUnit("piece")).toBe(true);
    expect(isValidUnit("box")).toBe(true);
    expect(isValidUnit("pack")).toBe(true);
  });

  it("rejects invalid units", () => {
    expect(isValidUnit("invalid")).toBe(false);
    expect(isValidUnit("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getAvailableUnits
// ---------------------------------------------------------------------------

describe("getAvailableUnits", () => {
  it("returns weight units for weight type", () => {
    const units = getAvailableUnits("weight");
    expect(units).toContain("g");
    expect(units).toContain("ounce");
    expect(units).toContain("pound");
    expect(units).not.toContain("tab");
  });

  it("returns count units for count type", () => {
    const units = getAvailableUnits("count");
    expect(units).toContain("unit");
    expect(units).toContain("tab");
    expect(units).toContain("piece");
    expect(units).not.toContain("g");
  });
});

// ---------------------------------------------------------------------------
// formatUnitLabel
// ---------------------------------------------------------------------------

describe("formatUnitLabel", () => {
  it("formats weight unit labels", () => {
    expect(formatUnitLabel("g")).toBe("g");
    expect(formatUnitLabel("ounce")).toBe("oz");
    expect(formatUnitLabel("pound")).toBe("lb");
  });

  it("formats count unit singular", () => {
    expect(formatUnitLabel("tab", 1)).toBe("tab");
    expect(formatUnitLabel("box", 1)).toBe("box");
  });

  it("formats count unit plural", () => {
    expect(formatUnitLabel("tab", 2)).toBe("tabs");
    expect(formatUnitLabel("box", 3)).toBe("boxes");
    expect(formatUnitLabel("piece", 5)).toBe("pieces");
  });

  it("returns raw string for unknown unit", () => {
    expect(formatUnitLabel("unknown")).toBe("unknown");
  });
});
