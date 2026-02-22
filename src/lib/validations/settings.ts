import { z } from "zod";

export const deliveryFeeTierSchema = z.object({
  min_miles: z.number().min(0, "Min miles cannot be negative"),
  max_miles: z.number().min(0, "Max miles cannot be negative"),
  fee: z.number().min(0, "Fee cannot be negative"),
});

export type DeliveryFeeTierInput = z.infer<typeof deliveryFeeTierSchema>;

export const appSettingsSchema = z.object({
  delivery_radius_miles: z.number().min(1, "Radius must be at least 1 mile").max(500),
  currency_symbol: z.string().min(1).max(5),
  min_order_amount: z.number().min(0),
  delivery_fee_tiers: z
    .array(deliveryFeeTierSchema)
    .min(1, "At least one fee tier is required")
    .refine(
      (tiers) => {
        for (const tier of tiers) {
          if (tier.max_miles <= tier.min_miles) return false;
        }
        return true;
      },
      { message: "Each tier's max_miles must be greater than min_miles" },
    ),
  default_latitude: z.number().min(-90).max(90),
  default_longitude: z.number().min(-180).max(180),
});

export type AppSettingsInput = z.infer<typeof appSettingsSchema>;
