import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
  customFieldDefinitionSchema,
} from "../categories";

// ---------------------------------------------------------------------------
// customFieldDefinitionSchema
// ---------------------------------------------------------------------------

describe("customFieldDefinitionSchema", () => {
  const validField = {
    key: "color",
    label: "Color",
    type: "text" as const,
  };

  it("accepts a valid field definition", () => {
    const result = customFieldDefinitionSchema.safeParse(validField);
    expect(result.success).toBe(true);
  });

  it("accepts all valid types", () => {
    for (const type of ["text", "number", "select", "boolean"] as const) {
      const result = customFieldDefinitionSchema.safeParse({ ...validField, type });
      expect(result.success).toBe(true);
    }
  });

  it("accepts optional fields (min, max, options)", () => {
    const result = customFieldDefinitionSchema.safeParse({
      ...validField,
      type: "number",
      required: true,
      min: 0,
      max: 100,
    });
    expect(result.success).toBe(true);
  });

  it("accepts options array for select type", () => {
    const result = customFieldDefinitionSchema.safeParse({
      ...validField,
      type: "select",
      options: ["red", "blue", "green"],
    });
    expect(result.success).toBe(true);
  });

  it("defaults required to false", () => {
    const result = customFieldDefinitionSchema.safeParse(validField);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.required).toBe(false);
    }
  });

  it("rejects empty key", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, key: "" });
    expect(result.success).toBe(false);
  });

  it("rejects key over 50 chars", () => {
    const result = customFieldDefinitionSchema.safeParse({
      ...validField,
      key: "a".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("rejects key starting with number", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, key: "1color" });
    expect(result.success).toBe(false);
  });

  it("rejects key with uppercase", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, key: "Color" });
    expect(result.success).toBe(false);
  });

  it("rejects key with hyphens", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, key: "my-key" });
    expect(result.success).toBe(false);
  });

  it("accepts key with underscores", () => {
    const result = customFieldDefinitionSchema.safeParse({
      ...validField,
      key: "my_key_2",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty label", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, label: "" });
    expect(result.success).toBe(false);
  });

  it("rejects label over 100 chars", () => {
    const result = customFieldDefinitionSchema.safeParse({
      ...validField,
      label: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = customFieldDefinitionSchema.safeParse({ ...validField, type: "date" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createCategorySchema
// ---------------------------------------------------------------------------

describe("createCategorySchema", () => {
  const validCategory = {
    name: "Flowers",
    slug: "flowers",
  };

  it("accepts a valid category with minimum fields", () => {
    const result = createCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
  });

  it("applies defaults correctly", () => {
    const result = createCategorySchema.safeParse(validCategory);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sort_order).toBe(0);
      expect(result.data.grade_visibility).toBe("classic");
      expect(result.data.unit_type).toBe("weight");
      expect(result.data.custom_fields_schema).toEqual([]);
      expect(result.data.low_stock_threshold).toBe(10);
      expect(result.data.is_active).toBe(true);
    }
  });

  it("accepts a fully populated category", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      icon: "🌿",
      sort_order: 5,
      grade_visibility: "premium",
      unit_type: "count",
      custom_fields_schema: [{ key: "thc", label: "THC %", type: "number" }],
      low_stock_threshold: 20,
      is_active: false,
    });
    expect(result.success).toBe(true);
  });

  // name
  it("rejects empty name", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name over 100 chars", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      name: "x".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  // slug
  it("rejects empty slug", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, slug: "" });
    expect(result.success).toBe(false);
  });

  it("rejects slug over 100 chars", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      slug: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects slug with uppercase", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, slug: "Flowers" });
    expect(result.success).toBe(false);
  });

  it("rejects slug starting with number", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, slug: "1flowers" });
    expect(result.success).toBe(false);
  });

  it("rejects slug with underscores", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      slug: "my_category",
    });
    expect(result.success).toBe(false);
  });

  it("accepts slug with hyphens", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      slug: "pre-rolls",
    });
    expect(result.success).toBe(true);
  });

  // grade_visibility
  it.each(["classic", "premium"] as const)("accepts grade_visibility: %s", (grade_visibility) => {
    const result = createCategorySchema.safeParse({ ...validCategory, grade_visibility });
    expect(result.success).toBe(true);
  });

  it("rejects invalid grade_visibility", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      grade_visibility: "none",
    });
    expect(result.success).toBe(false);
  });

  it("rejects grade_visibility: both", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      grade_visibility: "both",
    });
    expect(result.success).toBe(false);
  });

  // unit_type
  it.each(["weight", "count", "volume"] as const)("accepts unit_type: %s", (unit_type) => {
    const result = createCategorySchema.safeParse({ ...validCategory, unit_type });
    expect(result.success).toBe(true);
  });

  it("rejects invalid unit_type", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      unit_type: "length",
    });
    expect(result.success).toBe(false);
  });

  // sort_order
  it("rejects negative sort_order", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, sort_order: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer sort_order", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, sort_order: 1.5 });
    expect(result.success).toBe(false);
  });

  it("accepts zero sort_order", () => {
    const result = createCategorySchema.safeParse({ ...validCategory, sort_order: 0 });
    expect(result.success).toBe(true);
  });

  // low_stock_threshold
  it("rejects negative low_stock_threshold", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      low_stock_threshold: -5,
    });
    expect(result.success).toBe(false);
  });

  // icon
  it("rejects icon over 10 chars", () => {
    const result = createCategorySchema.safeParse({
      ...validCategory,
      icon: "x".repeat(11),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateCategorySchema
// ---------------------------------------------------------------------------

describe("updateCategorySchema", () => {
  it("accepts an empty object (all optional)", () => {
    const result = updateCategorySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts partial updates", () => {
    const result = updateCategorySchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("accepts updating only sort_order", () => {
    const result = updateCategorySchema.safeParse({ sort_order: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects empty name when provided", () => {
    const result = updateCategorySchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid slug when provided", () => {
    const result = updateCategorySchema.safeParse({ slug: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("rejects negative sort_order when provided", () => {
    const result = updateCategorySchema.safeParse({ sort_order: -1 });
    expect(result.success).toBe(false);
  });
});
