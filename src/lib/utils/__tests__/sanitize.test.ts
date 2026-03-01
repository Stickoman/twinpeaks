import { describe, it, expect } from "vitest";
import { sanitizeText } from "../sanitize";

describe("sanitizeText", () => {
  it("passes through normal text unchanged", () => {
    expect(sanitizeText("Hello World")).toBe("Hello World");
  });

  it("preserves accented characters", () => {
    expect(sanitizeText("Café résumé")).toBe("Café résumé");
  });

  it("strips HTML tags", () => {
    expect(sanitizeText("<b>Bold</b> text")).toBe("Bold text");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeText("<div><p>Nested</p></div>")).toBe("Nested");
  });

  it("strips script tags and content between angle brackets", () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it("strips self-closing HTML tags", () => {
    expect(sanitizeText("Line<br/>break")).toBe("Linebreak");
  });

  it("removes control characters", () => {
    expect(sanitizeText("Hello\x00World")).toBe("HelloWorld");
    expect(sanitizeText("Test\x01\x02\x03")).toBe("Test");
    expect(sanitizeText("Data\x7F")).toBe("Data");
  });

  it("preserves newlines, carriage returns, and tabs", () => {
    expect(sanitizeText("Line1\nLine2")).toBe("Line1\nLine2");
    expect(sanitizeText("Line1\rLine2")).toBe("Line1\rLine2");
    expect(sanitizeText("Col1\tCol2")).toBe("Col1\tCol2");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeText("  Hello  ")).toBe("Hello");
    expect(sanitizeText("\n  Text\n  ")).toBe("Text");
  });

  it("handles strings with only whitespace", () => {
    expect(sanitizeText("   ")).toBe("");
  });

  it("handles strings with only HTML tags", () => {
    expect(sanitizeText("<div></div>")).toBe("");
  });

  it("handles strings with mixed HTML and control characters", () => {
    expect(sanitizeText("  <b>Clean\x00</b>  ")).toBe("Clean");
  });
});
