import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  formatRelativeTime,
  generateSecureToken,
  isTokenExpired,
  getTokenExpiry,
  getGradeLabel,
} from "../helpers";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("formats a Date object", () => {
    const d = new Date("2026-01-15T14:30:00Z");
    const result = formatDate(d);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
    expect(result).toContain("2026");
  });

  it("formats an ISO string", () => {
    const result = formatDate("2025-12-25T09:00:00Z");
    expect(result).toContain("Dec");
    expect(result).toContain("25");
    expect(result).toContain("2025");
  });
});

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "just now" for times within 60 seconds', () => {
    const thirtySecsAgo = new Date("2026-02-21T11:59:31Z");
    expect(formatRelativeTime(thirtySecsAgo)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date("2026-02-21T11:55:00Z");
    expect(formatRelativeTime(fiveMinAgo)).toBe("5 minutes ago");
  });

  it("returns singular minute", () => {
    const oneMinAgo = new Date("2026-02-21T11:59:00Z");
    expect(formatRelativeTime(oneMinAgo)).toBe("1 minute ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date("2026-02-21T09:00:00Z");
    expect(formatRelativeTime(threeHoursAgo)).toBe("3 hours ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date("2026-02-19T12:00:00Z");
    expect(formatRelativeTime(twoDaysAgo)).toBe("2 days ago");
  });

  it("returns future time", () => {
    const inTwoHours = new Date("2026-02-21T14:00:00Z");
    expect(formatRelativeTime(inTwoHours)).toBe("in 2 hours");
  });

  it('returns "just now" for near-future times', () => {
    const inTenSecs = new Date("2026-02-21T12:00:10Z");
    expect(formatRelativeTime(inTenSecs)).toBe("just now");
  });
});

// ---------------------------------------------------------------------------
// generateSecureToken
// ---------------------------------------------------------------------------

describe("generateSecureToken", () => {
  it("returns a valid UUID v4", () => {
    const token = generateSecureToken();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidRegex);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateSecureToken()));
    expect(tokens.size).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// isTokenExpired
// ---------------------------------------------------------------------------

describe("isTokenExpired", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true for a past date", () => {
    expect(isTokenExpired("2026-02-21T11:00:00Z")).toBe(true);
  });

  it("returns true for the exact current time", () => {
    expect(isTokenExpired("2026-02-21T12:00:00Z")).toBe(true);
  });

  it("returns false for a future date", () => {
    expect(isTokenExpired("2026-02-21T13:00:00Z")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getTokenExpiry
// ---------------------------------------------------------------------------

describe("getTokenExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-21T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a date 15 minutes in the future", () => {
    const expiry = getTokenExpiry();
    const expected = new Date("2026-02-21T12:15:00Z");
    expect(expiry.getTime()).toBe(expected.getTime());
  });
});

// ---------------------------------------------------------------------------
// getGradeLabel
// ---------------------------------------------------------------------------

describe("getGradeLabel", () => {
  it('returns "Classic" for classic grade', () => {
    expect(getGradeLabel("classic")).toBe("Classic");
  });

  it('returns "Premium" for premium grade', () => {
    expect(getGradeLabel("premium")).toBe("Premium");
  });
});
