import { describe, it, expect } from "vitest";
import { parseCSV, validateRows } from "../import";
import type { ImportRow } from "../import";

// ---------------------------------------------------------------------------
// parseCSV
// ---------------------------------------------------------------------------

describe("parseCSV", () => {
  it("parses a valid CSV with standard headers", () => {
    const csv = "Name,Variety,Type,Quantity,Unit\nOG Kush,Indica,WEED,100,g";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("OG Kush");
    expect(rows[0].variety).toBe("Indica");
    expect(rows[0].type).toBe("WEED");
    expect(rows[0].quantity).toBe(100);
    expect(rows[0].unit_measure).toBe("g");
  });

  it("handles header aliases (Product, Qty, Category)", () => {
    const csv = "Product,Variety,Category,Qty,Unit\nBlue Dream,Hybrid,WEED,50,g";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Blue Dream");
    expect(rows[0].type).toBe("WEED");
    expect(rows[0].quantity).toBe(50);
  });

  it("handles case-insensitive headers", () => {
    const csv = "NAME,VARIETY,TYPE,QUANTITY,UNIT\nTest,Chardonnay,WINES,10,g";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test");
  });

  it("returns empty array for empty content", () => {
    const rows = parseCSV("");
    expect(rows).toHaveLength(0);
  });

  it("returns empty array for header-only CSV", () => {
    const rows = parseCSV("Name,Variety,Type,Quantity,Unit\n");
    expect(rows).toHaveLength(0);
  });

  it("parses multiple rows", () => {
    const csv =
      "Name,Variety,Type,Quantity,Unit\nOG Kush,Indica,WEED,100,g\nBlue Dream,Hybrid,WEED,50,ounce";
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
  });

  it("defaults unit_measure to 'g' when missing", () => {
    const csv = "Name,Variety,Quantity\nOG Kush,Indica,100";
    const rows = parseCSV(csv);
    expect(rows[0].unit_measure).toBe("g");
  });

  it("sets type to null when missing", () => {
    const csv = "Name,Variety,Quantity,Unit\nOG Kush,Indica,100,g";
    const rows = parseCSV(csv);
    expect(rows[0].type).toBeNull();
  });

  it("sets image_url to null when missing", () => {
    const csv = "Name,Variety,Quantity,Unit\nOG Kush,Indica,100,g";
    const rows = parseCSV(csv);
    expect(rows[0].image_url).toBeNull();
  });

  it("trims whitespace from values", () => {
    const csv = "Name,Variety,Quantity,Unit\n  OG Kush  ,  Indica  ,100,g";
    const rows = parseCSV(csv);
    expect(rows[0].name).toBe("OG Kush");
    expect(rows[0].variety).toBe("Indica");
  });

  it("converts non-numeric quantity to 0", () => {
    const csv = "Name,Variety,Quantity,Unit\nOG Kush,Indica,abc,g";
    const rows = parseCSV(csv);
    expect(rows[0].quantity).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateRows
// ---------------------------------------------------------------------------

describe("validateRows", () => {
  const validRow: ImportRow = {
    name: "OG Kush",
    variety: "Indica",
    type: "WEED",
    quantity: 100,
    unit_measure: "g",
    image_url: null,
  };

  it("marks a valid row as valid", () => {
    const results = validateRows([validRow], []);
    expect(results).toHaveLength(1);
    expect(results[0].valid).toBe(true);
    expect(results[0].errors).toHaveLength(0);
  });

  it("marks a row with empty name as invalid", () => {
    const results = validateRows([{ ...validRow, name: "" }], []);
    expect(results[0].valid).toBe(false);
    expect(results[0].errors.length).toBeGreaterThan(0);
  });

  it("marks a row with empty variety as invalid", () => {
    const results = validateRows([{ ...validRow, variety: "" }], []);
    expect(results[0].valid).toBe(false);
  });

  it("marks a row with negative quantity as invalid", () => {
    const results = validateRows([{ ...validRow, quantity: -1 }], []);
    expect(results[0].valid).toBe(false);
  });

  it("detects duplicates against existing items", () => {
    const existing = [{ name: "OG Kush", variety: "Indica" }];
    const results = validateRows([validRow], existing);
    expect(results[0].isDuplicate).toBe(true);
  });

  it("duplicate detection is case-insensitive", () => {
    const existing = [{ name: "og kush", variety: "indica" }];
    const results = validateRows([validRow], existing);
    expect(results[0].isDuplicate).toBe(true);
  });

  it("does not mark non-duplicates as duplicate", () => {
    const existing = [{ name: "Blue Dream", variety: "Hybrid" }];
    const results = validateRows([validRow], existing);
    expect(results[0].isDuplicate).toBe(false);
  });

  it("preserves the row index", () => {
    const results = validateRows([validRow, { ...validRow, name: "Other" }], []);
    expect(results[0].index).toBe(0);
    expect(results[1].index).toBe(1);
  });

  it("validates multiple rows independently", () => {
    const results = validateRows([validRow, { ...validRow, name: "", variety: "" }], []);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
  });
});
