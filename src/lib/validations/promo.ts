import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Create Promo Code
// ────────────────────────────────────────────────────────────

export const createPromoSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .max(30, "Code must be 30 characters or fewer")
    .regex(/^[A-Z0-9_-]+$/i, "Code can only contain letters, numbers, hyphens, and underscores")
    .transform((val) => val.toUpperCase()),
  discount_type: z.enum(["percentage", "fixed"], {
    message: "Discount type must be 'percentage' or 'fixed'",
  }),
  discount_value: z
    .number()
    .min(0.01, "Discount value must be greater than 0")
    .max(100_000, "Discount value cannot exceed 100,000"),
  min_order_amount: z.number().min(0).default(0),
  max_uses: z.number().int().min(1).nullable().optional(),
  valid_from: z.string().datetime().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CreatePromoInput = z.infer<typeof createPromoSchema>;

// ────────────────────────────────────────────────────────────
// Apply Promo Code (public validation)
// ────────────────────────────────────────────────────────────

export const applyPromoSchema = z.object({
  code: z.string().min(1, "Promo code is required").max(30),
  subtotal: z.number().min(0),
});

export type ApplyPromoInput = z.infer<typeof applyPromoSchema>;
