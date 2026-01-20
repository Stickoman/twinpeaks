import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { signMfaToken, mfaCookieOptions } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import * as OTPAuth from "otpauth";
import { totpVerifySchema } from "@/lib/validations/mfa";
import { checkRateLimit } from "@/lib/rate-limit";

// ────────────────────────────────────────────────────────────
// POST /api/auth/totp/verify — Verify TOTP code
//   - During setup: saves credential if valid
//   - During auth: verifies against stored secret
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = totpVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const userId = auth.session.userId;

    // Rate limit: 5 attempts per 5 minutes per user
    const { allowed } = await checkRateLimit(`mfa:totp:${userId}`, 5, 300);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    // Check if TOTP is already stored (auth mode)
    const { data: storedCred } = await supabase
      .from("user_credentials")
      .select("id, totp_secret")
      .eq("user_id", userId)
      .eq("credential_type", "totp")
      .limit(1)
      .single();

    if (storedCred?.totp_secret) {
      // Auth mode: verify against stored secret
      const totp = new OTPAuth.TOTP({
        issuer: "TP-Manager",
        label: auth.session.username,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(storedCred.totp_secret),
      });

      const delta = totp.validate({ token: parsed.data.code, window: 1 });

      if (delta === null) {
        return NextResponse.json({ error: "Invalid code" }, { status: 400 });
      }

      // Set MFA session cookie
      const mfaToken = await signMfaToken(userId);
      const cookieStore = await cookies();
      cookieStore.set("tp-mfa", mfaToken, mfaCookieOptions);

      return NextResponse.json({ verified: true });
    }

    // Setup mode: verify against challenge secret and save
    const { data: challenge } = await supabase
      .from("auth_challenges")
      .select("id, challenge")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "No pending TOTP setup found" }, { status: 400 });
    }

    const totp = new OTPAuth.TOTP({
      issuer: "TP-Manager",
      label: auth.session.username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(challenge.challenge),
    });

    const delta = totp.validate({ token: parsed.data.code, window: 1 });

    if (delta === null) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Save TOTP credential
    await supabase.from("user_credentials").insert({
      user_id: userId,
      credential_type: "totp" as const,
      credential_id: null,
      public_key: null,
      counter: 0,
      transports: [],
      totp_secret: challenge.challenge,
      name: "Authenticator App",
    });

    // Clean up challenge
    await supabase.from("auth_challenges").delete().eq("id", challenge.id);

    // Set MFA session cookie
    const mfaToken = await signMfaToken(userId);
    const cookieStore = await cookies();
    cookieStore.set("tp-mfa", mfaToken, mfaCookieOptions);

    return NextResponse.json({ verified: true, setup: true });
  } catch (err) {
    console.error("[TOTP verify] error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
