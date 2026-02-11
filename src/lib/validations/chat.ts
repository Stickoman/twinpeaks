import { z } from "zod";

export const createConversationSchema = z.object({
  driver_id: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
