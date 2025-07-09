import { TOKEN_TTL_MINUTES } from "./constants";

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format a date as a human-readable string (e.g. "Feb 21, 2026, 3:45 PM").
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Return a human-readable relative time string (e.g. "5 minutes ago",
 * "in 2 hours", "3 days ago").
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diffMs = d.getTime() - now;
  const absDiffMs = Math.abs(diffMs);

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const isFuture = diffMs > 0;

  const wrap = (value: number, unit: string): string => {
    const plural = value === 1 ? "" : "s";
    return isFuture ? `in ${value} ${unit}${plural}` : `${value} ${unit}${plural} ago`;
  };

  if (seconds < 60) return isFuture ? "just now" : "just now";
  if (minutes < 60) return wrap(minutes, "minute");
  if (hours < 24) return wrap(hours, "hour");
  return wrap(days, "day");
}

// ---------------------------------------------------------------------------
// Token utilities
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure token using `crypto.randomUUID()`.
 */
export function generateSecureToken(): string {
  return crypto.randomUUID();
}

/**
 * Check whether a token has expired.
 * @param expiresAt - ISO 8601 date string representing the expiry time.
 */
export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Compute the expiry date for a newly issued token.
 * Uses `TOKEN_TTL_MINUTES` from constants.
 */
export function getTokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

/**
 * Return the display label for a grade value.
 */
export function getGradeLabel(grade: "classic" | "premium"): string {
  const labels: Record<"classic" | "premium", string> = {
    classic: "Classic",
    premium: "Premium",
  };
  return labels[grade];
}
