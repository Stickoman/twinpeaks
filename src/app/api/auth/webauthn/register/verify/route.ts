import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { verifyRegistration } from "@/lib/webauthn";
import { webauthnRegisterVerifySchema } from "@/lib/validations/mfa";

// ────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/register/verify — Verify registration
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = webauthnRegisterVerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const userId = auth.session.userId;

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

    const verification = await verifyRegistration(parsed.data.credential, challenge.challenge);

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    const { credential } = verification.registrationInfo;

    // Store credential
    await supabase.from("user_credentials").insert({
      user_id: userId,
      credential_type: "webauthn" as const,
      credential_id: credential.id,
      public_key: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: parsed.data.credential.response.transports ?? [],
      totp_secret: null,
      name: parsed.data.name,
    });

    // Delete the used challenge by ID to prevent replay attacks
    await supabase.from("auth_challenges").delete().eq("id", challenge.id);

    // Also clean up any expired challenges
    await supabase
      .from("auth_challenges")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", new Date().toISOString());

    return NextResponse.json({ verified: true });
  } catch (err) {
    console.error("[WebAuthn register verify] error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
