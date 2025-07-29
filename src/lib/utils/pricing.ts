import type { WeightUnit } from "./units";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PricingTier {
  unit: string;
  price: number;
  min_quantity: number;
  max_quantity: number | null;
  sort_order: number;
}

export interface OrderLineItem {
  item_id: string;
  quantity: number;
  unit: string;
}

// ────────────────────────────────────────────────────────────
// Weight unit hierarchy (largest to smallest)
// ────────────────────────────────────────────────────────────

const WEIGHT_TIER_ORDER: WeightUnit[] = [
  "pound",
  "half_pound",
  "quarter_pound",
  "ounce",
  "half_ounce",
  "quarter_ounce",
  "g",
  "0.5g",
];

const UNIT_MULTIPLIER: Record<string, number> = {
  pound: 1,
  half_pound: 0.5,
  quarter_pound: 0.25,
  ounce: 1 / 16,
  half_ounce: 1 / 32,
  quarter_ounce: 1 / 64,
  g: 1 / 453.592,
  "0.5g": 0.5 / 453.592,
};

// ────────────────────────────────────────────────────────────
// Auto-generate default pricing tiers
// ────────────────────────────────────────────────────────────

/**
 * Generate default pricing tiers from a base price.
 * The markup curve increases for smaller quantities:
 * - Each step down gets `markupCoefficient` more expensive per unit
 *
 * @param basePrice - Price for the base unit
 * @param baseUnit - The unit the base price is for (e.g. "pound")
 * @param markupCoefficient - Markup factor per step (default 1.1 = 10% per step)
 * @returns Array of pricing tiers
 */
export function generateDefaultTiers(
  basePrice: number,
  baseUnit: string,
  markupCoefficient: number = 1.1,
): PricingTier[] {
  const baseIndex = WEIGHT_TIER_ORDER.indexOf(baseUnit as WeightUnit);
  if (baseIndex === -1) {
    // For non-weight units, just return the base tier
    return [
      {
        unit: baseUnit,
        price: basePrice,
        min_quantity: 1,
        max_quantity: null,
        sort_order: 0,
      },
    ];
  }

  const baseMultiplier = UNIT_MULTIPLIER[baseUnit];
  if (!baseMultiplier) return [];

  const pricePerPound = basePrice / baseMultiplier;
  const tiers: PricingTier[] = [];

  for (let i = baseIndex; i < WEIGHT_TIER_ORDER.length; i++) {
    const unit = WEIGHT_TIER_ORDER[i];
    const unitMultiplier = UNIT_MULTIPLIER[unit];
    if (!unitMultiplier) continue;

    const stepsFromBase = i - baseIndex;
    const markup = Math.pow(markupCoefficient, stepsFromBase);
    const price = roundPrice(pricePerPound * unitMultiplier * markup);

    tiers.push({
      unit,
      price,
      min_quantity: 1,
      max_quantity: null,
      sort_order: i - baseIndex,
    });
  }

  return tiers;
}

// ────────────────────────────────────────────────────────────
// Order total calculation
// ────────────────────────────────────────────────────────────

/**
 * Calculate the total for an order given items and their pricing tiers.
 * Falls back to `fallbackPrice` when no tier matches.
 */
export function calculateOrderTotal(
  items: OrderLineItem[],
  tiersByItem: Map<string, PricingTier[]>,
  fallbackPrices: Map<string, number>,
): { lineItems: { item_id: string; unit_price: number; subtotal: number }[]; total: number } {
  const lineItems = items.map((item) => {
    const tiers = tiersByItem.get(item.item_id);
    let unitPrice: number;

    if (tiers && tiers.length > 0) {
      const matchingTier = tiers.find(
        (t) =>
          t.unit === item.unit &&
          item.quantity >= t.min_quantity &&
          (t.max_quantity === null || item.quantity <= t.max_quantity),
      );
      unitPrice = matchingTier?.price ?? fallbackPrices.get(item.item_id) ?? 0;
    } else {
      unitPrice = fallbackPrices.get(item.item_id) ?? 0;
    }

    return {
      item_id: item.item_id,
      unit_price: unitPrice,
      subtotal: unitPrice * item.quantity,
    };
  });

  const total = lineItems.reduce((sum, li) => sum + li.subtotal, 0);
  return { lineItems, total };
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function roundPrice(price: number): number {
  return Math.round(price * 100) / 100;
}

/**
 * Calculate markup percentage between two prices.
 */
export function calculateMarkupPercent(basePrice: number, tierPrice: number): number {
  if (basePrice === 0) return 0;
  // Normalize to per-pound basis for comparison isn't needed here
  // This computes the simple percentage difference
  return roundPrice(((tierPrice - basePrice) / basePrice) * 100);
}
