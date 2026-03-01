import { describe, it, expect } from "vitest";
import { createOrderSchema, updateOrderStatusSchema, bulkUpdateOrderStatusSchema } from "../orders";

// ---------------------------------------------------------------------------
// createOrderSchema
// ---------------------------------------------------------------------------

describe("createOrderSchema", () => {
  const validOrder = {
    address: "123 Twin Peaks Blvd",
    items: [
      {
        item_id: "550e8400-e29b-41d4-a716-446655440000",
        name: "OG Kush",
        variety: "Indica",
        quantity: 2,
        unit: "g",
      },
    ],
  };

  it("accepts a valid order", () => {
    const result = createOrderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("accepts an order with notes", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, notes: "Ring the bell" });
    expect(result.success).toBe(true);
  });

  it("accepts null notes", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, notes: null });
    expect(result.success).toBe(true);
  });

  it("rejects empty address", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, address: "" });
    expect(result.success).toBe(false);
  });

  it("rejects address over 500 chars", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, address: "x".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects item with zero quantity", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        {
          item_id: "550e8400-e29b-41d4-a716-446655440000",
          name: "OG",
          variety: "Indica",
          quantity: 0,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with missing name", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        {
          item_id: "550e8400-e29b-41d4-a716-446655440000",
          name: "",
          variety: "Indica",
          quantity: 1,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item without item_id", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ name: "OG", variety: "Indica", quantity: 1, unit: "g" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with invalid item_id", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [{ item_id: "not-a-uuid", name: "OG", variety: "Indica", quantity: 1, unit: "g" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts multiple items", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        {
          item_id: "550e8400-e29b-41d4-a716-446655440000",
          name: "OG Kush",
          variety: "Indica",
          quantity: 2,
          unit: "g",
        },
        {
          item_id: "550e8400-e29b-41d4-a716-446655440001",
          name: "Blue Dream",
          variety: "Hybrid",
          quantity: 1,
          unit: "ounce",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 1000 chars", () => {
    const result = createOrderSchema.safeParse({ ...validOrder, notes: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("rejects quantity over 10000", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        {
          item_id: "550e8400-e29b-41d4-a716-446655440000",
          name: "OG",
          variety: "Indica",
          quantity: 10_001,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts quantity at 10000", () => {
    const result = createOrderSchema.safeParse({
      ...validOrder,
      items: [
        {
          item_id: "550e8400-e29b-41d4-a716-446655440000",
          name: "OG",
          variety: "Indica",
          quantity: 10_000,
          unit: "g",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, i) => ({
      item_id: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, "0")}`,
      name: `Item ${i}`,
      variety: "Indica",
      quantity: 1,
      unit: "g",
    }));
    const result = createOrderSchema.safeParse({ ...validOrder, items });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateOrderStatusSchema
// ---------------------------------------------------------------------------

describe("updateOrderStatusSchema", () => {
  it.each(["pending", "assigned", "en_route", "delivered", "cancelled"] as const)(
    "accepts valid status: %s",
    (status) => {
      const result = updateOrderStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    },
  );

  it("rejects invalid status", () => {
    const result = updateOrderStatusSchema.safeParse({ status: "shipped" });
    expect(result.success).toBe(false);
  });

  it("rejects empty status", () => {
    const result = updateOrderStatusSchema.safeParse({ status: "" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bulkUpdateOrderStatusSchema
// ---------------------------------------------------------------------------

describe("bulkUpdateOrderStatusSchema", () => {
  it("accepts valid bulk update", () => {
    const result = bulkUpdateOrderStatusSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "cancelled",
    });
    expect(result.success).toBe(true);
  });

  it("accepts multiple UUIDs", () => {
    const result = bulkUpdateOrderStatusSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
      status: "assigned",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty ids array", () => {
    const result = bulkUpdateOrderStatusSchema.safeParse({ ids: [], status: "pending" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID in ids", () => {
    const result = bulkUpdateOrderStatusSchema.safeParse({
      ids: ["not-a-uuid"],
      status: "pending",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = bulkUpdateOrderStatusSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
