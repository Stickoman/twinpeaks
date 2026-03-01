import { describe, it, expect } from "vitest";
import { buildCustomFieldsSchema } from "../custom-fields";
import type { CustomFieldDefinition } from "../categories";

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — empty definitions
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — empty definitions", () => {
  it("returns a schema that defaults to empty object", () => {
    const schema = buildCustomFieldsSchema([]);
    const result = schema.parse(undefined);
    expect(result).toEqual({});
  });

  it("accepts an empty object", () => {
    const schema = buildCustomFieldsSchema([]);
    const result = schema.parse({});
    expect(result).toEqual({});
  });

  it("accepts arbitrary keys with unknown values", () => {
    const schema = buildCustomFieldsSchema([]);
    const result = schema.parse({ foo: "bar", num: 42 });
    expect(result).toEqual({ foo: "bar", num: 42 });
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — text field
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — text field", () => {
  const defs: CustomFieldDefinition[] = [
    { key: "flavor", label: "Flavor", type: "text", required: true },
  ];

  it("accepts a valid text value", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ flavor: "citrus" });
    expect(result.success).toBe(true);
  });

  it("rejects missing required text field", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("allows optional text field to be omitted", () => {
    const optionalDefs: CustomFieldDefinition[] = [
      { key: "flavor", label: "Flavor", type: "text", required: false },
    ];
    const schema = buildCustomFieldsSchema(optionalDefs);
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("enforces min length on text field", () => {
    const minDefs: CustomFieldDefinition[] = [
      { key: "flavor", label: "Flavor", type: "text", required: true, min: 3 },
    ];
    const schema = buildCustomFieldsSchema(minDefs);
    expect(schema.safeParse({ flavor: "ab" }).success).toBe(false);
    expect(schema.safeParse({ flavor: "abc" }).success).toBe(true);
  });

  it("enforces max length on text field", () => {
    const maxDefs: CustomFieldDefinition[] = [
      { key: "flavor", label: "Flavor", type: "text", required: true, max: 5 },
    ];
    const schema = buildCustomFieldsSchema(maxDefs);
    expect(schema.safeParse({ flavor: "abcdef" }).success).toBe(false);
    expect(schema.safeParse({ flavor: "abcde" }).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — number field
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — number field", () => {
  const defs: CustomFieldDefinition[] = [
    { key: "thc_pct", label: "THC %", type: "number", required: true },
  ];

  it("accepts a valid number value", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ thc_pct: 25.5 });
    expect(result.success).toBe(true);
  });

  it("rejects a string for a number field", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ thc_pct: "25" });
    expect(result.success).toBe(false);
  });

  it("enforces min on number field", () => {
    const minDefs: CustomFieldDefinition[] = [
      { key: "thc_pct", label: "THC %", type: "number", required: true, min: 0 },
    ];
    const schema = buildCustomFieldsSchema(minDefs);
    expect(schema.safeParse({ thc_pct: -1 }).success).toBe(false);
    expect(schema.safeParse({ thc_pct: 0 }).success).toBe(true);
  });

  it("enforces max on number field", () => {
    const maxDefs: CustomFieldDefinition[] = [
      { key: "thc_pct", label: "THC %", type: "number", required: true, max: 100 },
    ];
    const schema = buildCustomFieldsSchema(maxDefs);
    expect(schema.safeParse({ thc_pct: 101 }).success).toBe(false);
    expect(schema.safeParse({ thc_pct: 100 }).success).toBe(true);
  });

  it("allows optional number field to be omitted", () => {
    const optionalDefs: CustomFieldDefinition[] = [
      { key: "thc_pct", label: "THC %", type: "number", required: false },
    ];
    const schema = buildCustomFieldsSchema(optionalDefs);
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — select field
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — select field", () => {
  const defs: CustomFieldDefinition[] = [
    {
      key: "origin",
      label: "Origin",
      type: "select",
      required: true,
      options: ["indoor", "outdoor", "greenhouse"],
    },
  ];

  it("accepts a valid option", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ origin: "indoor" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid option", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ origin: "hydroponic" });
    expect(result.success).toBe(false);
  });

  it("falls back to plain string when options array is empty", () => {
    const emptyOptionsDefs: CustomFieldDefinition[] = [
      { key: "origin", label: "Origin", type: "select", required: true, options: [] },
    ];
    const schema = buildCustomFieldsSchema(emptyOptionsDefs);
    const result = schema.safeParse({ origin: "anything" });
    expect(result.success).toBe(true);
  });

  it("falls back to plain string when options is undefined", () => {
    const noOptionsDefs: CustomFieldDefinition[] = [
      { key: "origin", label: "Origin", type: "select", required: true },
    ];
    const schema = buildCustomFieldsSchema(noOptionsDefs);
    const result = schema.safeParse({ origin: "anything" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — boolean field
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — boolean field", () => {
  const defs: CustomFieldDefinition[] = [
    { key: "organic", label: "Organic", type: "boolean", required: true },
  ];

  it("accepts true", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ organic: true });
    expect(result.success).toBe(true);
  });

  it("accepts false", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ organic: false });
    expect(result.success).toBe(true);
  });

  it("rejects a string for a boolean field", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ organic: "true" });
    expect(result.success).toBe(false);
  });

  it("allows optional boolean field to be omitted", () => {
    const optionalDefs: CustomFieldDefinition[] = [
      { key: "organic", label: "Organic", type: "boolean", required: false },
    ];
    const schema = buildCustomFieldsSchema(optionalDefs);
    const result = schema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — unknown field type
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — unknown field type", () => {
  it("accepts any value for an unknown field type", () => {
    const defs = [{ key: "mystery", label: "Mystery", type: "date" as "text", required: true }];
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ mystery: "anything" });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — passthrough behavior
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — passthrough", () => {
  it("preserves extra keys not in the definitions", () => {
    const defs: CustomFieldDefinition[] = [
      { key: "flavor", label: "Flavor", type: "text", required: true },
    ];
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({ flavor: "citrus", extra_key: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).extra_key).toBe(42);
    }
  });
});

// ---------------------------------------------------------------------------
// buildCustomFieldsSchema — multiple fields
// ---------------------------------------------------------------------------

describe("buildCustomFieldsSchema — multiple fields", () => {
  const defs: CustomFieldDefinition[] = [
    { key: "flavor", label: "Flavor", type: "text", required: true },
    { key: "thc_pct", label: "THC %", type: "number", required: false, min: 0, max: 100 },
    { key: "organic", label: "Organic", type: "boolean", required: true },
    {
      key: "origin",
      label: "Origin",
      type: "select",
      required: true,
      options: ["indoor", "outdoor"],
    },
  ];

  it("accepts valid data for all fields", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({
      flavor: "earthy",
      thc_pct: 22,
      organic: true,
      origin: "indoor",
    });
    expect(result.success).toBe(true);
  });

  it("accepts data with optional field omitted", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({
      flavor: "earthy",
      organic: false,
      origin: "outdoor",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when a required field is missing", () => {
    const schema = buildCustomFieldsSchema(defs);
    const result = schema.safeParse({
      thc_pct: 22,
      organic: true,
      origin: "indoor",
    });
    expect(result.success).toBe(false);
  });
});
