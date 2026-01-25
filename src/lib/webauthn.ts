import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";

// ────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────

const RP_NAME = "TP-Manager";

function getRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

function getOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
}

// ────────────────────────────────────────────────────────────
// Registration
// ────────────────────────────────────────────────────────────

export interface ExistingCredential {
  id: string;
  transports: string[];
}

export async function generateRegistration(
  userId: string,
  username: string,
  existingCredentials: ExistingCredential[],
) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpId(),
    userName: username,
    userID: new TextEncoder().encode(userId),
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
    excludeCredentials: existingCredentials.map((c) => ({
      id: c.id,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
  });
}

export async function verifyRegistration(
  credential: unknown,
  expectedChallenge: string,
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response: credential as Parameters<typeof verifyRegistrationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
  });
}

// ────────────────────────────────────────────────────────────
// Authentication
// ────────────────────────────────────────────────────────────

export interface StoredCredential {
  credentialID: string;
  publicKey: string;
  counter: number;
  transports: string[];
}

export async function generateAuthentication(allowCredentials: StoredCredential[]) {
  return generateAuthenticationOptions({
    rpID: getRpId(),
    allowCredentials: allowCredentials.map((c) => ({
      id: c.credentialID,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    userVerification: "preferred",
  });
}

export async function verifyAuthentication(
  credential: unknown,
  expectedChallenge: string,
  storedCredential: StoredCredential,
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response: credential as Parameters<typeof verifyAuthenticationResponse>[0]["response"],
    expectedChallenge,
    expectedOrigin: getOrigin(),
    expectedRPID: getRpId(),
    credential: {
      id: storedCredential.credentialID,
      publicKey: Buffer.from(storedCredential.publicKey, "base64url"),
      counter: storedCredential.counter,
      transports: storedCredential.transports as AuthenticatorTransportFuture[],
    },
  });
}
