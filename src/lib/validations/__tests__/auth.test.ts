import { describe, it, expect } from "vitest";
import { changePasswordSchema, passwordSchema } from "../auth";

// ---------------------------------------------------------------------------
// passwordSchema
// ---------------------------------------------------------------------------

describe("passwordSchema", () => {
  it("accepts a strong password", () => {
    const result = passwordSchema.safeParse("StrongPass1234");
    expect(result.success).toBe(true);
  });

  it("rejects password shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("Short1A");
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase letter", () => {
    const result = passwordSchema.safeParse("alllowercase1");
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase letter", () => {
    const result = passwordSchema.safeParse("ALLUPPERCASE1");
    expect(result.success).toBe(false);
  });

  it("rejects password without a number", () => {
    const result = passwordSchema.safeParse("NoNumbersHere");
    expect(result.success).toBe(false);
  });

  it("accepts password of exactly 12 characters", () => {
    const result = passwordSchema.safeParse("Abcdefghij1k");
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// changePasswordSchema
// ---------------------------------------------------------------------------

describe("changePasswordSchema", () => {
  it("accepts valid password change", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "NewSecure1234",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty current password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "",
      newPassword: "NewSecure1234",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short new password (< 12 chars)", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "Short1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects new password without uppercase", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "alllowercase1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects new password without lowercase", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "ALLUPPERCASE1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects new password without number", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "NoNumbersHere",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing currentPassword", () => {
    const result = changePasswordSchema.safeParse({ newPassword: "NewSecure1234" });
    expect(result.success).toBe(false);
  });

  it("rejects missing newPassword", () => {
    const result = changePasswordSchema.safeParse({ currentPassword: "oldpass123" });
    expect(result.success).toBe(false);
  });
});
