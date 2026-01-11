import { z } from "zod";

export const createPayrollSchema = z.object({
  driver_id: z.string().uuid(),
  period_start: z.string().date(),
  period_end: z.string().date(),
  base_pay: z.number().min(0),
  delivery_bonus: z.number().min(0),
  total_pay: z.number().min(0),
});

export const updatePayrollSchema = z.object({
  status: z.enum(["pending", "approved", "paid"]).optional(),
  base_pay: z.number().min(0).optional(),
  delivery_bonus: z.number().min(0).optional(),
  total_pay: z.number().min(0).optional(),
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollInput = z.infer<typeof updatePayrollSchema>;
