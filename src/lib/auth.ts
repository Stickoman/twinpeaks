import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { type ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserRole = "admin" | "super_admin" | "god_admin" | "driver";

export interface SessionPayload extends JWTPayload {
  userId: string;
  role: UserRole;
  username: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const COOKIE_NAME = "tp-session";

const SEVEN_DAYS_IN_SECONDS = 60 * 60 * 24 * 7;

/** Cookie options shared between set / delete operations. */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SEVEN_DAYS_IN_SECONDS,
};

// ---------------------------------------------------------------------------
// JWT helpers  (jose – works in Edge runtime)
// ---------------------------------------------------------------------------

function getSecret(): Uint8Array {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT containing the user session information.
 */
export async function signToken(payload: {
  userId: string;
  role: UserRole;
  username: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/**
 * Verify a JWT and return its payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as SessionPayload;
}

// ---------------------------------------------------------------------------
// Password helpers  (bcryptjs – pure JS, works everywhere)
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Session helper
// ---------------------------------------------------------------------------

/**
 * Read and verify the session cookie.
 * Returns the decoded payload or `null` when no valid session exists.
 */
export async function getSession(cookies: ReadonlyRequestCookies): Promise<SessionPayload | null> {
  const token = cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifyToken(token);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// MFA session helpers
// ---------------------------------------------------------------------------

const MFA_COOKIE_NAME = "tp-mfa";
const MFA_MAX_AGE = 1800; // 30 minutes

export { MFA_COOKIE_NAME };

export const mfaCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: MFA_MAX_AGE,
};

/**
 * Create a signed JWT for MFA verification.
 * Short-lived (30 min) — used as an httpOnly cookie.
 */
export async function signMfaToken(userId: string): Promise<string> {
  return new SignJWT({ userId, mfaVerified: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_MAX_AGE}s`)
    .sign(getSecret());
}

/**
 * Verify an MFA JWT token and return its payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyMfaToken(
  token: string,
): Promise<{ userId: string; mfaVerified: boolean }> {
  const { payload } = await jwtVerify(token, getSecret());
  return payload as unknown as { userId: string; mfaVerified: boolean };
}

// ---------------------------------------------------------------------------
// Role helpers
// ---------------------------------------------------------------------------

export function isAdmin(role: string): boolean {
  return role === "admin" || role === "super_admin" || role === "god_admin";
}

export function isSuperAdmin(role: string): boolean {
  return role === "super_admin" || role === "god_admin";
}

export function isGodAdmin(role: string): boolean {
  return role === "god_admin";
}

export function isDriver(role: string): boolean {
  return role === "driver";
}
