import type { Unit } from "./units";

// ---------------------------------------------------------------------------
// Item categories
// ---------------------------------------------------------------------------

/**
 * @deprecated Use the categories API (/api/categories) instead.
 * Kept only for backward compatibility with items.type column.
 */
export const ITEM_CATEGORIES = [
  { value: "Wines & Champagnes", label: "Wines & Champagnes" },
  { value: "Spirits", label: "Spirits" },
  { value: "Fine Grocery", label: "Fine Grocery" },
  { value: "Truffles & Foie Gras", label: "Truffles & Foie Gras" },
  { value: "Caviar & Seafood", label: "Caviar & Seafood" },
  { value: "Gift Sets", label: "Gift Sets" },
] as const;

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]["value"];

// ---------------------------------------------------------------------------
// Order statuses
// ---------------------------------------------------------------------------

export const ORDER_STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "En Route" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number]["value"];

// ---------------------------------------------------------------------------
// Auth / token settings
// ---------------------------------------------------------------------------

export const TOKEN_TTL_MINUTES = 15;
export const MAX_ACCESS_ATTEMPTS = 5;

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export const WEIGHT_UNITS: readonly { value: Unit; label: string }[] = [
  { value: "g", label: "Gram" },
  { value: "0.5g", label: "Half Gram" },
  { value: "eighth", label: "Eighth (3.5 g)" },
  { value: "ounce", label: "Ounce (28.35 g)" },
  { value: "half_ounce", label: "Half Ounce (14.17 g)" },
  { value: "quarter_ounce", label: "Quarter Ounce (7.09 g)" },
  { value: "pound", label: "Pound (453.59 g)" },
  { value: "half_pound", label: "Half Pound (226.80 g)" },
  { value: "quarter_pound", label: "Quarter Pound (113.40 g)" },
] as const;

export const COUNT_UNITS: readonly { value: Unit; label: string }[] = [
  { value: "unit", label: "Unit" },
  { value: "box", label: "Box" },
  { value: "pack", label: "Pack" },
  { value: "tab", label: "Tab" },
  { value: "piece", label: "Piece" },
] as const;

export const UNITS: readonly { value: Unit; label: string }[] = [
  ...WEIGHT_UNITS,
  ...COUNT_UNITS,
] as const;

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = [
  {
    value: "admin",
    label: "Admin",
    permissions: ["read", "write"],
  },
  {
    value: "super_admin",
    label: "Super Admin",
    permissions: ["read", "write", "delete", "manage_admins"],
  },
  {
    value: "god_admin",
    label: "God Admin",
    permissions: [
      "read",
      "write",
      "delete",
      "manage_admins",
      "manage_super_admins",
      "system_config",
    ],
  },
] as const;

export type Role = (typeof ROLES)[number]["value"];
