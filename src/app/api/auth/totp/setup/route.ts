import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

// ────────────────────────────────────────────────────────────
// POST /api/auth/totp/setup — Generate TOTP secret + QR code
// ────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;

    // Check if TOTP already set up
    const { data: existing } = await supabase
      .from("user_credentials")
      .select("id")
      .eq("user_id", userId)
      .eq("credential_type", "totp")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "TOTP already configured" }, { status: 409 });
    }

    // Generate TOTP secret
    const totp = new OTPAuth.TOTP({
      issuer: "TP-Manager",
      label: auth.session.username,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    });

    const uri = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(uri);

    // Store secret temporarily (not yet verified)
    // We store it in auth_challenges so it's cleaned up automatically
    const { error: insertError } = await supabase.from("auth_challenges").insert({
      user_id: userId,
      challenge: totp.secret.base32,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertError) {
      console.error("[TOTP setup] failed to store challenge:", insertError);
      return NextResponse.json({ error: "Failed to initialize TOTP setup" }, { status: 500 });
    }

    return NextResponse.json({
      qrCode: qrDataUrl,
      secret: totp.secret.base32,
    });
  } catch (err) {
    console.error("[TOTP setup] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
