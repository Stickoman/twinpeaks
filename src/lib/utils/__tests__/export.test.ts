import { describe, it, expect } from "vitest";
import { generateItemTemplate } from "../export";

// ---------------------------------------------------------------------------
// generateItemTemplate
// ---------------------------------------------------------------------------

describe("generateItemTemplate", () => {
  it("returns a CSV string with headers and example row", () => {
    const csv = generateItemTemplate();
    expect(csv).toContain("Name");
    expect(csv).toContain("Variety");
    expect(csv).toContain("Type");
    expect(csv).toContain("Quantity");
    expect(csv).toContain("Unit");
  });

  it("contains example data", () => {
    const csv = generateItemTemplate();
    expect(csv).toContain("OG Kush");
    expect(csv).toContain("Indica");
    expect(csv).toContain("WEED");
    expect(csv).toContain("100");
  });

  it("has exactly 2 lines (header + example)", () => {
    const csv = generateItemTemplate();
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("first line contains all 5 headers", () => {
    const csv = generateItemTemplate();
    const headers = csv.trim().split("\n")[0].replace(/\r$/, "");
    expect(headers).toBe("Name,Variety,Type,Quantity,Unit");
  });
});
