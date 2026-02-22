import { z } from "zod";

export const endShiftSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type EndShiftInput = z.infer<typeof endShiftSchema>;
