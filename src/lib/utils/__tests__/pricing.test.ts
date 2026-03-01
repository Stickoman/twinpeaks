import { describe, it, expect } from "vitest";
import { generateDefaultTiers, calculateOrderTotal, calculateMarkupPercent } from "../pricing";

// ---------------------------------------------------------------------------
// generateDefaultTiers
// ---------------------------------------------------------------------------

describe("generateDefaultTiers", () => {
  it("generates tiers from a pound base price", () => {
    const tiers = generateDefaultTiers(700, "pound", 1.1);
    expect(tiers.length).toBeGreaterThan(1);
    expect(tiers[0].unit).toBe("pound");
    expect(tiers[0].price).toBe(700);
  });

  it("applies increasing markup for smaller units", () => {
    const tiers = generateDefaultTiers(700, "pound", 1.1);
    // Each subsequent tier should have a higher per-unit price relative to pound
    const poundTier = tiers.find((t) => t.unit === "pound");
    const ounceTier = tiers.find((t) => t.unit === "ounce");

    expect(poundTier).toBeDefined();
    expect(ounceTier).toBeDefined();

    if (poundTier && ounceTier) {
      // Ounce should cost more per pound-equivalent than the pound price
      const poundEquivFromOunce = ounceTier.price * 16;
      expect(poundEquivFromOunce).toBeGreaterThan(poundTier.price);
    }
  });

  it("generates single tier for non-weight unit", () => {
    const tiers = generateDefaultTiers(10, "tab", 1.1);
    expect(tiers).toHaveLength(1);
    expect(tiers[0].unit).toBe("tab");
    expect(tiers[0].price).toBe(10);
  });

  it("all tiers have min_quantity of 1", () => {
    const tiers = generateDefaultTiers(500, "pound");
    for (const tier of tiers) {
      expect(tier.min_quantity).toBe(1);
    }
  });

  it("tiers are sorted by sort_order", () => {
    const tiers = generateDefaultTiers(700, "pound");
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].sort_order).toBeGreaterThanOrEqual(tiers[i - 1].sort_order);
    }
  });

  it("respects custom markup coefficient", () => {
    const lowMarkup = generateDefaultTiers(700, "pound", 1.05);
    const highMarkup = generateDefaultTiers(700, "pound", 1.2);

    const lowOunce = lowMarkup.find((t) => t.unit === "ounce");
    const highOunce = highMarkup.find((t) => t.unit === "ounce");

    expect(lowOunce).toBeDefined();
    expect(highOunce).toBeDefined();

    if (lowOunce && highOunce) {
      expect(highOunce.price).toBeGreaterThan(lowOunce.price);
    }
  });
});

// ---------------------------------------------------------------------------
// calculateOrderTotal
// ---------------------------------------------------------------------------

describe("calculateOrderTotal", () => {
  it("calculates total using matching tiers", () => {
    const items = [{ item_id: "item-1", quantity: 2, unit: "ounce" }];
    const tiers = new Map([
      [
        "item-1",
        [{ unit: "ounce", price: 55, min_quantity: 1, max_quantity: null, sort_order: 0 }],
      ],
    ]);
    const fallback = new Map([["item-1", 50]]);

    const result = calculateOrderTotal(items, tiers, fallback);
    expect(result.total).toBe(110);
    expect(result.lineItems[0].unit_price).toBe(55);
  });

  it("falls back to fallback price when no tier matches", () => {
    const items = [{ item_id: "item-1", quantity: 1, unit: "tab" }];
    const tiers = new Map([
      [
        "item-1",
        [{ unit: "ounce", price: 55, min_quantity: 1, max_quantity: null, sort_order: 0 }],
      ],
    ]);
    const fallback = new Map([["item-1", 10]]);

    const result = calculateOrderTotal(items, tiers, fallback);
    expect(result.total).toBe(10);
    expect(result.lineItems[0].unit_price).toBe(10);
  });

  it("falls back when item has no tiers", () => {
    const items = [{ item_id: "item-2", quantity: 3, unit: "g" }];
    const tiers = new Map<string, never[]>();
    const fallback = new Map([["item-2", 5]]);

    const result = calculateOrderTotal(items, tiers, fallback);
    expect(result.total).toBe(15);
  });

  it("calculates multi-item orders correctly", () => {
    const items = [
      { item_id: "item-1", quantity: 2, unit: "ounce" },
      { item_id: "item-2", quantity: 1, unit: "pound" },
    ];
    const tiers = new Map([
      [
        "item-1",
        [{ unit: "ounce", price: 50, min_quantity: 1, max_quantity: null, sort_order: 0 }],
      ],
      [
        "item-2",
        [{ unit: "pound", price: 700, min_quantity: 1, max_quantity: null, sort_order: 0 }],
      ],
    ]);
    const fallback = new Map<string, number>();

    const result = calculateOrderTotal(items, tiers, fallback);
    expect(result.total).toBe(800);
    expect(result.lineItems).toHaveLength(2);
  });

  it("returns 0 for empty order", () => {
    const result = calculateOrderTotal([], new Map(), new Map());
    expect(result.total).toBe(0);
    expect(result.lineItems).toHaveLength(0);
  });

  it("respects min_quantity and max_quantity constraints", () => {
    const items = [{ item_id: "item-1", quantity: 5, unit: "ounce" }];
    const tiers = new Map([
      [
        "item-1",
        [
          { unit: "ounce", price: 60, min_quantity: 1, max_quantity: 3, sort_order: 0 },
          { unit: "ounce", price: 50, min_quantity: 4, max_quantity: null, sort_order: 1 },
        ],
      ],
    ]);
    const fallback = new Map([["item-1", 70]]);

    const result = calculateOrderTotal(items, tiers, fallback);
    // qty 5 matches the 4+ tier at $50
    expect(result.lineItems[0].unit_price).toBe(50);
    expect(result.total).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// calculateMarkupPercent
// ---------------------------------------------------------------------------

describe("calculateMarkupPercent", () => {
  it("calculates correct markup percentage", () => {
    expect(calculateMarkupPercent(100, 110)).toBe(10);
  });

  it("returns 0 for zero base price", () => {
    expect(calculateMarkupPercent(0, 50)).toBe(0);
  });

  it("handles negative markup (discount)", () => {
    expect(calculateMarkupPercent(100, 90)).toBe(-10);
  });
});
