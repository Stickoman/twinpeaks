import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Shared sub-schemas
// ────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "pending",
  "assigned",
  "en_route",
  "delivered",
  "cancelled",
] as const;

const orderItemSchema = z.object({
  item_id: z.string().uuid("Invalid item ID"),
  name: z
    .string()
    .min(1, "Item name is required")
    .max(255, "Item name must be 255 characters or fewer"),
  variety: z
    .string()
    .min(1, "Variety is required")
    .max(255, "Variety must be 255 characters or fewer"),
  quantity: z
    .number()
    .min(0.01, "Quantity must be greater than 0")
    .max(10_000, "Quantity cannot exceed 10,000")
    .finite("Quantity must be a finite number"),
  unit: z.string().min(1, "Unit is required").max(50, "Unit must be 50 characters or fewer"),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;

// ────────────────────────────────────────────────────────────
// Create Order
// ────────────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  address: z
    .string()
    .min(1, "Address is required")
    .max(500, "Address must be 500 characters or fewer"),
  items: z
    .array(orderItemSchema)
    .min(1, "At least one item is required")
    .max(50, "Maximum 50 items per order"),
  notes: z.string().max(1000).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  promo_code: z.string().max(100).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// ────────────────────────────────────────────────────────────
// Update Order Status
// ────────────────────────────────────────────────────────────

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, {
    message: `Status must be one of: ${ORDER_STATUSES.join(", ")}`,
  }),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// ────────────────────────────────────────────────────────────
// Bulk Update Order Status
// ────────────────────────────────────────────────────────────

export const bulkUpdateOrderStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(ORDER_STATUSES),
});

export type BulkUpdateOrderStatusInput = z.infer<typeof bulkUpdateOrderStatusSchema>;
