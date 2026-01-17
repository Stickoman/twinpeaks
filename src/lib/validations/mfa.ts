import { z } from "zod";

export const webauthnRegisterVerifySchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string(),
      transports: z.array(z.string()).optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  }),
  name: z.string().min(1).max(100).default("Default"),
});

export const webauthnAuthVerifySchema = z.object({
  credential: z.object({
    id: z.string(),
    rawId: z.string(),
    response: z.object({
      clientDataJSON: z.string(),
      authenticatorData: z.string(),
      signature: z.string(),
      userHandle: z.string().optional(),
    }),
    type: z.literal("public-key"),
    clientExtensionResults: z.record(z.string(), z.unknown()).optional(),
    authenticatorAttachment: z.string().optional(),
  }),
});

export const totpVerifySchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, "Must be 6 digits"),
});
