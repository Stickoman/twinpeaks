import { describe, it, expect } from "vitest";
import { createPromoSchema, applyPromoSchema } from "../promo";

// ---------------------------------------------------------------------------
// createPromoSchema
// ---------------------------------------------------------------------------

describe("createPromoSchema", () => {
  it("accepts valid percentage promo code", () => {
    const result = createPromoSchema.safeParse({
      code: "SAVE20",
      discount_type: "percentage",
      discount_value: 20,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("SAVE20"); // uppercased
      expect(result.data.discount_type).toBe("percentage");
    }
  });

  it("accepts valid fixed promo code", () => {
    const result = createPromoSchema.safeParse({
      code: "flat-10",
      discount_type: "fixed",
      discount_value: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("FLAT-10");
    }
  });

  it("uppercases the code", () => {
    const result = createPromoSchema.safeParse({
      code: "lowercase",
      discount_type: "fixed",
      discount_value: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("LOWERCASE");
    }
  });

  it("rejects code shorter than 3 characters", () => {
    const result = createPromoSchema.safeParse({
      code: "AB",
      discount_type: "fixed",
      discount_value: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects code with special characters", () => {
    const result = createPromoSchema.safeParse({
      code: "SAVE@20%",
      discount_type: "percentage",
      discount_value: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid discount_type", () => {
    const result = createPromoSchema.safeParse({
      code: "SAVE20",
      discount_type: "bogus",
      discount_value: 20,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative discount_value", () => {
    const result = createPromoSchema.safeParse({
      code: "SAVE20",
      discount_type: "percentage",
      discount_value: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero discount_value", () => {
    const result = createPromoSchema.safeParse({
      code: "SAVE20",
      discount_type: "percentage",
      discount_value: 0,
    });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = createPromoSchema.safeParse({
      code: "PROMO",
      discount_type: "fixed",
      discount_value: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_order_amount).toBe(0);
      expect(result.data.is_active).toBe(true);
    }
  });

  it("accepts code with hyphens and underscores", () => {
    const result = createPromoSchema.safeParse({
      code: "BLACK_FRIDAY-2024",
      discount_type: "percentage",
      discount_value: 25,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyPromoSchema
// ---------------------------------------------------------------------------

describe("applyPromoSchema", () => {
  it("accepts valid apply input", () => {
    const result = applyPromoSchema.safeParse({
      code: "SAVE20",
      subtotal: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty code", () => {
    const result = applyPromoSchema.safeParse({
      code: "",
      subtotal: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative subtotal", () => {
    const result = applyPromoSchema.safeParse({
      code: "SAVE",
      subtotal: -1,
    });
    expect(result.success).toBe(false);
  });

  it("accepts zero subtotal", () => {
    const result = applyPromoSchema.safeParse({
      code: "SAVE",
      subtotal: 0,
    });
    expect(result.success).toBe(true);
  });
});
