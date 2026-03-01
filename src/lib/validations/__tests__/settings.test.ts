import { describe, it, expect } from "vitest";
import { appSettingsSchema, deliveryFeeTierSchema } from "../settings";

// ---------------------------------------------------------------------------
// deliveryFeeTierSchema
// ---------------------------------------------------------------------------

describe("deliveryFeeTierSchema", () => {
  it("accepts a valid tier", () => {
    const result = deliveryFeeTierSchema.safeParse({
      min_miles: 0,
      max_miles: 10,
      fee: 5,
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero fee", () => {
    const result = deliveryFeeTierSchema.safeParse({
      min_miles: 0,
      max_miles: 10,
      fee: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative min_miles", () => {
    const result = deliveryFeeTierSchema.safeParse({
      min_miles: -1,
      max_miles: 10,
      fee: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative fee", () => {
    const result = deliveryFeeTierSchema.safeParse({
      min_miles: 0,
      max_miles: 10,
      fee: -5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing min_miles", () => {
    const result = deliveryFeeTierSchema.safeParse({ max_miles: 10, fee: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing max_miles", () => {
    const result = deliveryFeeTierSchema.safeParse({ min_miles: 0, fee: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects missing fee", () => {
    const result = deliveryFeeTierSchema.safeParse({ min_miles: 0, max_miles: 10 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appSettingsSchema
// ---------------------------------------------------------------------------

describe("appSettingsSchema", () => {
  const validSettings = {
    delivery_radius_miles: 30,
    currency_symbol: "$",
    min_order_amount: 0,
    delivery_fee_tiers: [
      { min_miles: 0, max_miles: 10, fee: 0 },
      { min_miles: 10, max_miles: 20, fee: 10 },
    ],
    default_latitude: 40.7128,
    default_longitude: -74.006,
  };

  it("accepts valid settings", () => {
    const result = appSettingsSchema.safeParse(validSettings);
    expect(result.success).toBe(true);
  });

  it("rejects radius below 1", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_radius_miles: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects radius above 500", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_radius_miles: 501,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty currency symbol", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      currency_symbol: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative min order amount", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      min_order_amount: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fee tiers", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_fee_tiers: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects tier where max_miles <= min_miles", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_fee_tiers: [{ min_miles: 10, max_miles: 10, fee: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects tier where max_miles < min_miles", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_fee_tiers: [{ min_miles: 20, max_miles: 10, fee: 5 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid settings with a single tier {min_miles:0, max_miles:10, fee:0}", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_fee_tiers: [{ min_miles: 0, max_miles: 10, fee: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid settings with multiple tiers", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      delivery_radius_miles: 50,
      currency_symbol: "€",
      min_order_amount: 5,
      delivery_fee_tiers: [
        { min_miles: 0, max_miles: 10, fee: 0 },
        { min_miles: 10, max_miles: 20, fee: 5 },
        { min_miles: 20, max_miles: 50, fee: 15 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects latitude below -90", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      default_latitude: -91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude above 90", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      default_latitude: 91,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude below -180", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      default_longitude: -181,
    });
    expect(result.success).toBe(false);
  });

  it("rejects longitude above 180", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      default_longitude: 181,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid coordinates", () => {
    const result = appSettingsSchema.safeParse({
      ...validSettings,
      default_latitude: 48.8566,
      default_longitude: 2.3522,
    });
    expect(result.success).toBe(true);
  });
});
