import { describe, it, expect } from "vitest";
import { createTokenSchema, validateTokenSchema } from "../tokens";

// ---------------------------------------------------------------------------
// createTokenSchema
// ---------------------------------------------------------------------------

describe("createTokenSchema", () => {
  it("accepts classic grade", () => {
    const result = createTokenSchema.safeParse({ grade: "classic" });
    expect(result.success).toBe(true);
  });

  it("accepts premium grade", () => {
    const result = createTokenSchema.safeParse({ grade: "premium" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid grade", () => {
    const result = createTokenSchema.safeParse({ grade: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects empty grade", () => {
    const result = createTokenSchema.safeParse({ grade: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing grade", () => {
    const result = createTokenSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateTokenSchema
// ---------------------------------------------------------------------------

describe("validateTokenSchema", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts a valid UUID token", () => {
    const result = validateTokenSchema.safeParse({ token: validUUID });
    expect(result.success).toBe(true);
  });

  it("accepts a token with optional fingerprint", () => {
    const result = validateTokenSchema.safeParse({
      token: validUUID,
      fingerprint: "abc123fingerprint",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty token", () => {
    const result = validateTokenSchema.safeParse({ token: "" });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID token", () => {
    const result = validateTokenSchema.safeParse({ token: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing token", () => {
    const result = validateTokenSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
