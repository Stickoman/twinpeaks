// ────────────────────────────────────────────────────────────
// Weight units
// ────────────────────────────────────────────────────────────

export type WeightUnit =
  | "g"
  | "0.5g"
  | "eighth"
  | "ounce"
  | "half_ounce"
  | "quarter_ounce"
  | "pound"
  | "half_pound"
  | "quarter_pound";

// ────────────────────────────────────────────────────────────
// Count units (non-weight items like edibles, tabs, etc.)
// ────────────────────────────────────────────────────────────

export type CountUnit = "unit" | "box" | "pack" | "tab" | "piece";

// ────────────────────────────────────────────────────────────
// Combined item unit type
// ────────────────────────────────────────────────────────────

export type Unit = WeightUnit | CountUnit;

export type UnitType = "weight" | "count" | "volume";

// ────────────────────────────────────────────────────────────
// Weight conversion constants
// ────────────────────────────────────────────────────────────

const GRAMS_PER_OUNCE = 28.3495;
const GRAMS_PER_POUND = 453.592;

const UNIT_TO_GRAMS: Record<WeightUnit, number> = {
  g: 1,
  "0.5g": 0.5,
  eighth: GRAMS_PER_OUNCE / 8,
  ounce: GRAMS_PER_OUNCE,
  half_ounce: GRAMS_PER_OUNCE / 2,
  quarter_ounce: GRAMS_PER_OUNCE / 4,
  pound: GRAMS_PER_POUND,
  half_pound: GRAMS_PER_POUND / 2,
  quarter_pound: GRAMS_PER_POUND / 4,
};

const WEIGHT_UNITS: WeightUnit[] = [
  "g",
  "0.5g",
  "eighth",
  "ounce",
  "half_ounce",
  "quarter_ounce",
  "pound",
  "half_pound",
  "quarter_pound",
];

const COUNT_UNITS: CountUnit[] = ["unit", "box", "pack", "tab", "piece"];

// ────────────────────────────────────────────────────────────
// Unit helpers
// ────────────────────────────────────────────────────────────

function isWeightUnit(unit: string): unit is WeightUnit {
  return unit in UNIT_TO_GRAMS;
}

function isCountUnit(unit: string): unit is CountUnit {
  return COUNT_UNITS.includes(unit as CountUnit);
}

export function isValidUnit(unit: string): unit is Unit {
  return isWeightUnit(unit) || isCountUnit(unit);
}

/**
 * Returns available units based on category unit_type.
 */
export function getAvailableUnits(unitType: UnitType): Unit[] {
  switch (unitType) {
    case "weight":
      return WEIGHT_UNITS;
    case "count":
      return COUNT_UNITS;
    case "volume":
      return WEIGHT_UNITS; // fallback to weight for now
    default:
      return WEIGHT_UNITS;
  }
}

/**
 * Format a unit label with optional pluralization for count units.
 */
export function formatUnitLabel(unit: string, quantity?: number): string {
  const COUNT_LABELS: Record<CountUnit, { singular: string; plural: string }> = {
    unit: { singular: "unit", plural: "units" },
    box: { singular: "box", plural: "boxes" },
    pack: { singular: "pack", plural: "packs" },
    tab: { singular: "tab", plural: "tabs" },
    piece: { singular: "piece", plural: "pieces" },
  };

  if (isCountUnit(unit)) {
    const labels = COUNT_LABELS[unit];
    return quantity !== undefined && quantity !== 1 ? labels.plural : labels.singular;
  }

  // Weight unit labels
  const WEIGHT_LABELS: Record<WeightUnit, string> = {
    g: "g",
    "0.5g": "g",
    eighth: "oz",
    ounce: "oz",
    half_ounce: "oz",
    quarter_ounce: "oz",
    pound: "lb",
    half_pound: "lb",
    quarter_pound: "lb",
  };

  if (isWeightUnit(unit)) {
    return WEIGHT_LABELS[unit];
  }

  return unit;
}

// ────────────────────────────────────────────────────────────
// Weight conversion functions
// ────────────────────────────────────────────────────────────

/**
 * Convert a quantity in the given unit to grams.
 */
export function convertToGrams(quantity: number, unit: string): number {
  if (!isWeightUnit(unit)) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return quantity * UNIT_TO_GRAMS[unit];
}

/**
 * Convert a weight in grams to the given unit.
 */
export function convertFromGrams(grams: number, unit: string): number {
  if (!isWeightUnit(unit)) {
    throw new Error(`Unknown unit: ${unit}`);
  }
  return grams / UNIT_TO_GRAMS[unit];
}

/**
 * Convert a quantity from one unit to another.
 * For weight units: converts via grams as intermediate.
 * For count units or mixed types: returns quantity unchanged.
 */
export function convertUnits(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;
  if (!isWeightUnit(fromUnit) || !isWeightUnit(toUnit)) return quantity;
  const grams = convertToGrams(quantity, fromUnit);
  return convertFromGrams(grams, toUnit);
}

/**
 * Check whether there is enough stock (in grams) to fulfill a request
 * expressed as a quantity in the given unit.
 */
export function checkStockAvailability(
  availableGrams: number,
  requestedQuantity: number,
  requestedUnit: string,
): boolean {
  const requestedGrams = convertToGrams(requestedQuantity, requestedUnit);
  return availableGrams >= requestedGrams;
}

// ────────────────────────────────────────────────────────────
// Display formatting
// ────────────────────────────────────────────────────────────

const UNIT_LABELS: Record<WeightUnit, string> = {
  g: "g",
  "0.5g": "g",
  eighth: "oz",
  ounce: "oz",
  half_ounce: "oz",
  quarter_ounce: "oz",
  pound: "lb",
  half_pound: "lb",
  quarter_pound: "lb",
};

/**
 * Format a quantity with its human-readable unit label.
 * Examples:
 *   formatQuantityWithUnit(2, "ounce")        => "2 oz"
 *   formatQuantityWithUnit(3, "0.5g")         => "1.5 g"
 *   formatQuantityWithUnit(1, "quarter_pound") => "0.25 lb"
 *   formatQuantityWithUnit(3, "tab")           => "3 tabs"
 */
export function formatQuantityWithUnit(quantity: number, unit: string): string {
  if (isCountUnit(unit)) {
    return `${quantity} ${formatUnitLabel(unit, quantity)}`;
  }

  if (!isWeightUnit(unit)) {
    throw new Error(`Unknown unit: ${unit}`);
  }

  const label = UNIT_LABELS[unit];

  // For fractional units, convert quantity to the base-unit value
  // so the display reads naturally (e.g. 3 x 0.5g => "1.5 g").
  const multipliers: Partial<Record<WeightUnit, number>> = {
    "0.5g": 0.5,
    eighth: 0.125,
    half_ounce: 0.5,
    quarter_ounce: 0.25,
    half_pound: 0.5,
    quarter_pound: 0.25,
  };

  const multiplier = multipliers[unit];
  const displayQuantity = multiplier !== undefined ? quantity * multiplier : quantity;

  // Remove unnecessary trailing zeros
  const formatted = parseFloat(displayQuantity.toFixed(4)).toString();

  return `${formatted} ${label}`;
}
