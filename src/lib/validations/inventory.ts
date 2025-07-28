import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Create Item
// ────────────────────────────────────────────────────────────

export const createItemSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or fewer"),
  type: z.string().max(100).nullable().optional(),
  variety: z
    .string()
    .min(1, "Variety is required")
    .max(255, "Variety must be 255 characters or fewer"),
  quantity: z
    .number()
    .min(0, "Quantity cannot be negative")
    .finite("Quantity must be a finite number"),
  price: z.number().min(0, "Price cannot be negative").default(0),
  unit_measure: z.string().max(50).default("g"),
  image_url: z.union([z.string().url("Invalid image URL"), z.literal(""), z.null()]).optional(),
  category_id: z.string().uuid("Invalid category ID").nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  low_stock_threshold: z.number().min(0, "Threshold cannot be negative").nullable().optional(),
  badges: z
    .array(z.enum(["PREMIUM", "BESTSELLER", "LIMITED", "SEASONAL", "PROMO", "HOT", "NEW"]))
    .default([]),
  is_featured: z.boolean().default(false),
});

export type CreateItemInput = z.input<typeof createItemSchema>;

// ────────────────────────────────────────────────────────────
// Update Item (all fields optional)
// ────────────────────────────────────────────────────────────

export const updateItemSchema = z.object({
  name: z
    .string()
    .min(1, "Name cannot be empty")
    .max(255, "Name must be 255 characters or fewer")
    .optional(),
  type: z.string().max(100).nullable().optional(),
  variety: z
    .string()
    .min(1, "Variety cannot be empty")
    .max(255, "Variety must be 255 characters or fewer")
    .optional(),
  quantity: z
    .number()
    .min(0, "Quantity cannot be negative")
    .finite("Quantity must be a finite number")
    .optional(),
  price: z.number().min(0, "Price cannot be negative").optional(),
  unit_measure: z.string().max(50).optional(),
  image_url: z.union([z.string().url("Invalid image URL"), z.literal(""), z.null()]).optional(),
  category_id: z.string().uuid("Invalid category ID").nullable().optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
  low_stock_threshold: z.number().min(0, "Threshold cannot be negative").nullable().optional(),
  badges: z
    .array(z.enum(["PREMIUM", "BESTSELLER", "LIMITED", "SEASONAL", "PROMO", "HOT", "NEW"]))
    .optional(),
  is_featured: z.boolean().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
