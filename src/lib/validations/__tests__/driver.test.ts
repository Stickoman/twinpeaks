import { describe, it, expect } from "vitest";
import {
  updateLocationSchema,
  confirmDeliverySchema,
  createDriverSchema,
  isValidStatusTransition,
} from "../driver";

// ---------------------------------------------------------------------------
// updateLocationSchema
// ---------------------------------------------------------------------------

describe("updateLocationSchema", () => {
  const validLocation = {
    latitude: 48.8566,
    longitude: 2.3522,
  };

  it("accepts valid GPS coordinates", () => {
    const result = updateLocationSchema.safeParse(validLocation);
    expect(result.success).toBe(true);
  });

  it("accepts optional fields (accuracy, heading, speed)", () => {
    const result = updateLocationSchema.safeParse({
      ...validLocation,
      accuracy: 10,
      heading: 180,
      speed: 50,
    });
    expect(result.success).toBe(true);
  });

  // latitude boundaries
  it("accepts latitude at -90 (south pole)", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, latitude: -90 });
    expect(result.success).toBe(true);
  });

  it("accepts latitude at 90 (north pole)", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, latitude: 90 });
    expect(result.success).toBe(true);
  });

  it("rejects latitude below -90", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, latitude: -90.1 });
    expect(result.success).toBe(false);
  });

  it("rejects latitude above 90", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, latitude: 90.1 });
    expect(result.success).toBe(false);
  });

  // longitude boundaries
  it("accepts longitude at -180", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, longitude: -180 });
    expect(result.success).toBe(true);
  });

  it("accepts longitude at 180", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, longitude: 180 });
    expect(result.success).toBe(true);
  });

  it("rejects longitude below -180", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, longitude: -180.1 });
    expect(result.success).toBe(false);
  });

  it("rejects longitude above 180", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, longitude: 180.1 });
    expect(result.success).toBe(false);
  });

  // heading
  it("rejects heading below 0", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, heading: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects heading above 360", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, heading: 361 });
    expect(result.success).toBe(false);
  });

  // speed
  it("rejects negative speed", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, speed: -1 });
    expect(result.success).toBe(false);
  });

  // accuracy
  it("rejects negative accuracy", () => {
    const result = updateLocationSchema.safeParse({ ...validLocation, accuracy: -5 });
    expect(result.success).toBe(false);
  });

  // missing required fields
  it("rejects missing latitude", () => {
    const result = updateLocationSchema.safeParse({ longitude: 2.3522 });
    expect(result.success).toBe(false);
  });

  it("rejects missing longitude", () => {
    const result = updateLocationSchema.safeParse({ latitude: 48.8566 });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// confirmDeliverySchema
// ---------------------------------------------------------------------------

describe("confirmDeliverySchema", () => {
  const validDelivery = {
    delivery_code: "1234",
    latitude: 48.8566,
    longitude: 2.3522,
  };

  it("accepts valid delivery confirmation with required fields only", () => {
    const result = confirmDeliverySchema.safeParse(validDelivery);
    expect(result.success).toBe(true);
  });

  it("accepts delivery with optional photo_url and notes", () => {
    const result = confirmDeliverySchema.safeParse({
      ...validDelivery,
      photo_url: "https://example.com/photo.jpg",
      notes: "Left at door",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid photo_url", () => {
    const result = confirmDeliverySchema.safeParse({
      ...validDelivery,
      photo_url: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 500 chars", () => {
    const result = confirmDeliverySchema.safeParse({
      ...validDelivery,
      notes: "x".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it("rejects latitude out of range", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, latitude: 91 });
    expect(result.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, longitude: -181 });
    expect(result.success).toBe(false);
  });

  // delivery_code validation
  it("rejects missing delivery_code", () => {
    const { delivery_code: _, ...rest } = validDelivery;
    void _;
    const result = confirmDeliverySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects delivery_code that is not 4 digits", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, delivery_code: "123" });
    expect(result.success).toBe(false);
  });

  it("rejects delivery_code with 5 digits", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, delivery_code: "12345" });
    expect(result.success).toBe(false);
  });

  it("rejects delivery_code with letters", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, delivery_code: "12ab" });
    expect(result.success).toBe(false);
  });

  it("accepts delivery_code 0000", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, delivery_code: "0000" });
    expect(result.success).toBe(true);
  });

  it("accepts delivery_code 9999", () => {
    const result = confirmDeliverySchema.safeParse({ ...validDelivery, delivery_code: "9999" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createDriverSchema
// ---------------------------------------------------------------------------

describe("createDriverSchema", () => {
  const validDriver = {
    username: "driver1",
    password: "SecurePass123",
  };

  it("accepts a valid driver with required fields", () => {
    const result = createDriverSchema.safeParse(validDriver);
    expect(result.success).toBe(true);
  });

  it("accepts a driver with optional fields", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      phone: "+33612345678",
      vehicle_info: "Black Toyota Corolla",
    });
    expect(result.success).toBe(true);
  });

  it("rejects username under 3 chars", () => {
    const result = createDriverSchema.safeParse({ ...validDriver, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("rejects username over 50 chars", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      username: "x".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects password under 12 chars", () => {
    const result = createDriverSchema.safeParse({ ...validDriver, password: "Short1" });
    expect(result.success).toBe(false);
  });

  it("rejects password without uppercase", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      password: "alllowercase1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without lowercase", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      password: "ALLUPPERCASE1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password without number", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      password: "NoNumbersHere",
    });
    expect(result.success).toBe(false);
  });

  it("rejects password over 100 chars", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      password: "Aa1" + "x".repeat(98),
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone over 20 chars", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      phone: "1".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("rejects vehicle_info over 200 chars", () => {
    const result = createDriverSchema.safeParse({
      ...validDriver,
      vehicle_info: "x".repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isValidStatusTransition
// ---------------------------------------------------------------------------

describe("isValidStatusTransition", () => {
  // pending transitions
  it("allows pending → assigned", () => {
    expect(isValidStatusTransition("pending", "assigned")).toBe(true);
  });

  it("allows pending → cancelled", () => {
    expect(isValidStatusTransition("pending", "cancelled")).toBe(true);
  });

  it("rejects pending → en_route", () => {
    expect(isValidStatusTransition("pending", "en_route")).toBe(false);
  });

  it("rejects pending → delivered", () => {
    expect(isValidStatusTransition("pending", "delivered")).toBe(false);
  });

  // assigned transitions
  it("allows assigned → en_route", () => {
    expect(isValidStatusTransition("assigned", "en_route")).toBe(true);
  });

  it("allows assigned → pending", () => {
    expect(isValidStatusTransition("assigned", "pending")).toBe(true);
  });

  it("allows assigned → cancelled", () => {
    expect(isValidStatusTransition("assigned", "cancelled")).toBe(true);
  });

  it("rejects assigned → delivered", () => {
    expect(isValidStatusTransition("assigned", "delivered")).toBe(false);
  });

  // en_route transitions
  it("allows en_route → delivered", () => {
    expect(isValidStatusTransition("en_route", "delivered")).toBe(true);
  });

  it("allows en_route → cancelled", () => {
    expect(isValidStatusTransition("en_route", "cancelled")).toBe(true);
  });

  it("rejects en_route → pending", () => {
    expect(isValidStatusTransition("en_route", "pending")).toBe(false);
  });

  it("rejects en_route → assigned", () => {
    expect(isValidStatusTransition("en_route", "assigned")).toBe(false);
  });

  // delivered transitions (terminal state)
  it("rejects delivered → pending", () => {
    expect(isValidStatusTransition("delivered", "pending")).toBe(false);
  });

  it("rejects delivered → assigned", () => {
    expect(isValidStatusTransition("delivered", "assigned")).toBe(false);
  });

  it("rejects delivered → en_route", () => {
    expect(isValidStatusTransition("delivered", "en_route")).toBe(false);
  });

  it("rejects delivered → cancelled", () => {
    expect(isValidStatusTransition("delivered", "cancelled")).toBe(false);
  });

  // cancelled transitions
  it("allows cancelled → pending", () => {
    expect(isValidStatusTransition("cancelled", "pending")).toBe(true);
  });

  it("rejects cancelled → assigned", () => {
    expect(isValidStatusTransition("cancelled", "assigned")).toBe(false);
  });

  it("rejects cancelled → en_route", () => {
    expect(isValidStatusTransition("cancelled", "en_route")).toBe(false);
  });

  it("rejects cancelled → delivered", () => {
    expect(isValidStatusTransition("cancelled", "delivered")).toBe(false);
  });

  // unknown status
  it("rejects unknown source status", () => {
    expect(isValidStatusTransition("unknown", "pending")).toBe(false);
  });
});
