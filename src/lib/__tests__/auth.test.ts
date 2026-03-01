import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  isAdmin,
  isSuperAdmin,
  isGodAdmin,
} from "../auth";

// Set the secret for JWT operations
beforeAll(() => {
  vi.stubEnv("ACCESS_TOKEN_SECRET", "test-secret-key-for-unit-tests-only");
});

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

describe("hashPassword / comparePassword", () => {
  it("hashes and verifies a password", async () => {
    const password = "MySecureP@ss123";
    const hash = await hashPassword(password);
    expect(hash).not.toBe(password);
    expect(await comparePassword(password, hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("correct-password");
    expect(await comparePassword("wrong-password", hash)).toBe(false);
  });

  it("produces different hashes for same password (salted)", async () => {
    const password = "same-password";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2);
  });
});

// ---------------------------------------------------------------------------
// JWT sign / verify
// ---------------------------------------------------------------------------

describe("signToken / verifyToken", () => {
  const payload = {
    userId: "user-123",
    role: "admin" as const,
    username: "testuser",
  };

  it("signs and verifies a token", async () => {
    const token = await signToken(payload);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const decoded = await verifyToken(token);
    expect(decoded.userId).toBe("user-123");
    expect(decoded.role).toBe("admin");
    expect(decoded.username).toBe("testuser");
  });

  it("rejects a tampered token", async () => {
    const token = await signToken(payload);
    const tampered = token.slice(0, -5) + "XXXXX";
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it("rejects a completely invalid token", async () => {
    await expect(verifyToken("not.a.token")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

describe("isAdmin", () => {
  it("returns true for admin", () => expect(isAdmin("admin")).toBe(true));
  it("returns true for super_admin", () => expect(isAdmin("super_admin")).toBe(true));
  it("returns true for god_admin", () => expect(isAdmin("god_admin")).toBe(true));
  it("returns false for unknown role", () => expect(isAdmin("viewer")).toBe(false));
  it("returns false for empty string", () => expect(isAdmin("")).toBe(false));
});

describe("isSuperAdmin", () => {
  it("returns false for admin", () => expect(isSuperAdmin("admin")).toBe(false));
  it("returns true for super_admin", () => expect(isSuperAdmin("super_admin")).toBe(true));
  it("returns true for god_admin", () => expect(isSuperAdmin("god_admin")).toBe(true));
  it("returns false for unknown role", () => expect(isSuperAdmin("viewer")).toBe(false));
});

describe("isGodAdmin", () => {
  it("returns false for admin", () => expect(isGodAdmin("admin")).toBe(false));
  it("returns false for super_admin", () => expect(isGodAdmin("super_admin")).toBe(false));
  it("returns true for god_admin", () => expect(isGodAdmin("god_admin")).toBe(true));
  it("returns false for unknown role", () => expect(isGodAdmin("viewer")).toBe(false));
});
