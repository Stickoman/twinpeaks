import { describe, it, expect } from "vitest";
import { createItemSchema, updateItemSchema } from "../inventory";

// ---------------------------------------------------------------------------
// createItemSchema
// ---------------------------------------------------------------------------

describe("createItemSchema", () => {
  const validItem = {
    name: "OG Kush",
    variety: "Indica",
    quantity: 100,
  };

  it("accepts a valid item with minimum fields", () => {
    const result = createItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("applies default unit_measure of 'g'", () => {
    const result = createItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.unit_measure).toBe("g");
    }
  });

  it("accepts a fully populated item", () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      type: "WEED",
      unit_measure: "ounce",
      image_url: "https://example.com/image.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createItemSchema.safeParse({ ...validItem, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 255 chars", () => {
    const result = createItemSchema.safeParse({ ...validItem, name: "x".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects empty variety", () => {
    const result = createItemSchema.safeParse({ ...validItem, variety: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity", () => {
    const result = createItemSchema.safeParse({ ...validItem, quantity: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects Infinity quantity", () => {
    const result = createItemSchema.safeParse({ ...validItem, quantity: Infinity });
    expect(result.success).toBe(false);
  });

  it("accepts zero quantity", () => {
    const result = createItemSchema.safeParse({ ...validItem, quantity: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts null type", () => {
    const result = createItemSchema.safeParse({ ...validItem, type: null });
    expect(result.success).toBe(true);
  });

  it("accepts empty string image_url", () => {
    const result = createItemSchema.safeParse({ ...validItem, image_url: "" });
    expect(result.success).toBe(true);
  });

  it("accepts null image_url", () => {
    const result = createItemSchema.safeParse({ ...validItem, image_url: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid image_url", () => {
    const result = createItemSchema.safeParse({ ...validItem, image_url: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateItemSchema
// ---------------------------------------------------------------------------

describe("updateItemSchema", () => {
  it("accepts an empty object (all optional)", () => {
    const result = updateItemSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const result = updateItemSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name when provided", () => {
    const result = updateItemSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects negative quantity when provided", () => {
    const result = updateItemSchema.safeParse({ quantity: -5 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createItemSchema — price field
// ---------------------------------------------------------------------------

describe("createItemSchema — price", () => {
  const validItem = {
    name: "OG Kush",
    variety: "Indica",
    quantity: 100,
  };

  it("defaults price to 0 when omitted", () => {
    const result = createItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(0);
    }
  });

  it("accepts price of 0", () => {
    const result = createItemSchema.safeParse({ ...validItem, price: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(0);
    }
  });

  it("accepts price of 0.01", () => {
    const result = createItemSchema.safeParse({ ...validItem, price: 0.01 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(0.01);
    }
  });

  it("accepts price of 99.99", () => {
    const result = createItemSchema.safeParse({ ...validItem, price: 99.99 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price).toBe(99.99);
    }
  });

  it("rejects negative price", () => {
    const result = createItemSchema.safeParse({ ...validItem, price: -1 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateItemSchema — price field
// ---------------------------------------------------------------------------

describe("updateItemSchema — price", () => {
  it("accepts price of 0", () => {
    const result = updateItemSchema.safeParse({ price: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts price of 0.01", () => {
    const result = updateItemSchema.safeParse({ price: 0.01 });
    expect(result.success).toBe(true);
  });

  it("accepts price of 99.99", () => {
    const result = updateItemSchema.safeParse({ price: 99.99 });
    expect(result.success).toBe(true);
  });

  it("rejects negative price", () => {
    const result = updateItemSchema.safeParse({ price: -5 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createItemSchema — badges & is_featured
// ---------------------------------------------------------------------------

describe("createItemSchema — badges & is_featured", () => {
  const validItem = {
    name: "OG Kush",
    variety: "Indica",
    quantity: 100,
  };

  it("defaults badges to empty array", () => {
    const result = createItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.badges).toEqual([]);
    }
  });

  it("defaults is_featured to false", () => {
    const result = createItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_featured).toBe(false);
    }
  });

  it("accepts valid badges", () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      badges: ["PREMIUM", "BESTSELLER"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.badges).toEqual(["PREMIUM", "BESTSELLER"]);
    }
  });

  it("rejects invalid badge value", () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      badges: ["PREMIUM", "INVALID"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts is_featured true", () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      is_featured: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_featured).toBe(true);
    }
  });

  it("accepts all badge values", () => {
    const result = createItemSchema.safeParse({
      ...validItem,
      badges: ["PREMIUM", "BESTSELLER", "LIMITED", "SEASONAL", "PROMO"],
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// updateItemSchema — badges & is_featured
// ---------------------------------------------------------------------------

describe("updateItemSchema — badges & is_featured", () => {
  it("accepts badges update", () => {
    const result = updateItemSchema.safeParse({ badges: ["PROMO"] });
    expect(result.success).toBe(true);
  });

  it("accepts is_featured update", () => {
    const result = updateItemSchema.safeParse({ is_featured: true });
    expect(result.success).toBe(true);
  });

  it("rejects invalid badge in update", () => {
    const result = updateItemSchema.safeParse({ badges: ["BOGUS"] });
    expect(result.success).toBe(false);
  });
});
