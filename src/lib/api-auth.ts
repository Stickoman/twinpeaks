import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  verifyToken,
  verifyMfaToken,
  MFA_COOKIE_NAME,
  type SessionPayload,
  type UserRole,
} from "./auth";

const COOKIE_NAME = "tp-session";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  driver: 0,
  admin: 1,
  super_admin: 2,
  god_admin: 3,
};

type AuthSuccess = { authenticated: true; session: SessionPayload };
type AuthFailure = { authenticated: false; response: NextResponse };
type AuthResult = AuthSuccess | AuthFailure;

/**
 * Verify the session cookie and optionally check role hierarchy.
 * Use in API route handlers to protect endpoints.
 *
 * @param minRole - Minimum role required (e.g. "super_admin" means super_admin or god_admin)
 */
export async function requireAuth(minRole?: UserRole): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  let session: SessionPayload;
  try {
    session = await verifyToken(token);
  } catch {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Invalid or expired session" }, { status: 401 }),
    };
  }

  if (minRole) {
    const userLevel = ROLE_HIERARCHY[session.role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

    if (userLevel < requiredLevel) {
      return {
        authenticated: false,
        response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }),
      };
    }
  }

  return { authenticated: true, session };
}

/**
 * Verify the session cookie and require `driver` role.
 * Use in driver-facing API route handlers.
 */
export async function requireDriver(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }

  let session: SessionPayload;
  try {
    session = await verifyToken(token);
  } catch {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Invalid session" }, { status: 401 }),
    };
  }

  if (session.role !== "driver") {
    return {
      authenticated: false,
      response: NextResponse.json({ error: "Driver access required" }, { status: 403 }),
    };
  }

  return { authenticated: true, session };
}

// ---------------------------------------------------------------------------
// MFA guard
// ---------------------------------------------------------------------------

type MfaSuccess = { verified: true };
type MfaFailure = { verified: false; response: NextResponse };
type MfaResult = MfaSuccess | MfaFailure;

/**
 * Check that the `tp-mfa` cookie is present and contains a valid, non-expired JWT.
 * Call this **after** `requireAuth()` in sensitive routes that need MFA.
 */
export async function requireMfa(): Promise<MfaResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MFA_COOKIE_NAME)?.value;

  if (!token) {
    return {
      verified: false,
      response: NextResponse.json({ error: "MFA verification required" }, { status: 403 }),
    };
  }

  try {
    const payload = await verifyMfaToken(token);
    if (!payload.mfaVerified) {
      return {
        verified: false,
        response: NextResponse.json({ error: "MFA verification required" }, { status: 403 }),
      };
    }
    return { verified: true };
  } catch {
    return {
      verified: false,
      response: NextResponse.json({ error: "MFA verification required" }, { status: 403 }),
    };
  }
}
