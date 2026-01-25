import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { signMfaToken, mfaCookieOptions } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyAuthentication, type StoredCredential } from "@/lib/webauthn";
import { webauthnAuthVerifySchema } from "@/lib/validations/mfa";
import { checkRateLimit } from "@/lib/rate-limit";

// ────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/authenticate/verify — Verify auth
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = webauthnAuthVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const userId = auth.session.userId;

    // Rate limit: 5 attempts per 5 minutes per user
    const { allowed } = await checkRateLimit(`mfa:webauthn:${userId}`, 5, 300);
    if (!allowed) {
      return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
    }

    // Get latest challenge
    const { data: challenge } = await supabase
      .from("auth_challenges")
      .select("id, challenge")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!challenge) {
      return NextResponse.json({ error: "Challenge expired or not found" }, { status: 400 });
    }

    // Find the matching credential
    const { data: cred } = await supabase
      .from("user_credentials")
      .select("id, credential_id, public_key, counter, transports")
      .eq("user_id", userId)
      .eq("credential_type", "webauthn")
      .eq("credential_id", parsed.data.credential.id)
      .single();

    if (!cred || !cred.credential_id || !cred.public_key) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    const stored: StoredCredential = {
      credentialID: cred.credential_id,
      publicKey: cred.public_key,
      counter: cred.counter ?? 0,
      transports: cred.transports ?? [],
    };

    const verification = await verifyAuthentication(
      parsed.data.credential,
      challenge.challenge,
      stored,
    );

    if (!verification.verified) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    // Update counter
    await supabase
      .from("user_credentials")
      .update({ counter: verification.authenticationInfo.newCounter })
      .eq("id", cred.id);

    // Delete the used challenge by ID to prevent replay attacks
    await supabase.from("auth_challenges").delete().eq("id", challenge.id);

    // Also clean up any expired challenges
    await supabase
      .from("auth_challenges")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString());

    // Set MFA session cookie
    const mfaToken = await signMfaToken(userId);
    const cookieStore = await cookies();
    cookieStore.set("tp-mfa", mfaToken, mfaCookieOptions);

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("[WebAuthn authenticate verify] error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
