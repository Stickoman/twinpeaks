import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  order_id: z.string().uuid(),
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
