import { z } from "zod";
import { passwordSchema } from "@/lib/validations/auth";

// ────────────────────────────────────────────────────────────
// Location update
// ────────────────────────────────────────────────────────────

export const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().min(0).optional(),
});

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

// ────────────────────────────────────────────────────────────
// Delivery confirmation
// ────────────────────────────────────────────────────────────

export const confirmDeliverySchema = z.object({
  delivery_code: z
    .string()
    .length(4, "Delivery code must be exactly 4 digits")
    .regex(/^\d{4}$/, "Delivery code must be 4 digits"),
  photo_url: z
    .string()
    .url()
    .refine(
      (url) =>
        !process.env.NEXT_PUBLIC_SUPABASE_URL ||
        url.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/`),
      "Photo must be uploaded to project storage",
    )
    .optional(),
  notes: z.string().max(500).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export type ConfirmDeliveryInput = z.infer<typeof confirmDeliverySchema>;

// ────────────────────────────────────────────────────────────
// Driver CRUD
// ────────────────────────────────────────────────────────────

export const createDriverSchema = z.object({
  username: z.string().min(3).max(50),
  password: passwordSchema.pipe(z.string().max(100)),
  phone: z.string().max(20).optional(),
  vehicle_info: z.string().max(200).optional(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = z.object({
  phone: z.string().max(20).optional(),
  vehicle_info: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
  is_trusted: z.boolean().optional(),
});

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

// ────────────────────────────────────────────────────────────
// Order assignment
// ────────────────────────────────────────────────────────────

export const assignOrderSchema = z.object({
  driver_id: z.string().uuid(),
});

export type AssignOrderInput = z.infer<typeof assignOrderSchema>;

// ────────────────────────────────────────────────────────────
// Route optimization
// ────────────────────────────────────────────────────────────

export const routeOptimizeSchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1).max(50),
});

export type RouteOptimizeInput = z.infer<typeof routeOptimizeSchema>;

// ────────────────────────────────────────────────────────────
// Status transition validation
// ────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "cancelled"],
  assigned: ["en_route", "pending", "cancelled"],
  en_route: ["delivered", "cancelled"],
  delivered: [],
  cancelled: ["pending"],
};

export function isValidStatusTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
