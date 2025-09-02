import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Token grade tiers
// ────────────────────────────────────────────────────────────

const TOKEN_GRADES = ["classic", "premium"] as const;

// ────────────────────────────────────────────────────────────
// Create Token
// ────────────────────────────────────────────────────────────

export const createTokenSchema = z.object({
  grade: z.enum(TOKEN_GRADES, {
    message: `Grade must be one of: ${TOKEN_GRADES.join(", ")}`,
  }),
});

export type CreateTokenInput = z.infer<typeof createTokenSchema>;

// ────────────────────────────────────────────────────────────
// Validate Token (submitted by external user)
// ────────────────────────────────────────────────────────────

export const validateTokenSchema = z.object({
  token: z.string().min(1, "Token is required").uuid("Token must be a valid UUID"),
  fingerprint: z.string().optional(),
});

export type ValidateTokenInput = z.infer<typeof validateTokenSchema>;
