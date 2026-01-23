import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateRegistration, type ExistingCredential } from "@/lib/webauthn";

// ────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/register — Generate registration options
// ────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;

    // Get existing WebAuthn credentials
    const { data: existing } = await supabase
      .from("user_credentials")
      .select("credential_id, transports")
      .eq("user_id", userId)
      .eq("credential_type", "webauthn");

    const existingCreds: ExistingCredential[] = (existing ?? [])
      .filter((c) => c.credential_id)
      .map((c) => ({
        id: c.credential_id!,
        transports: c.transports ?? [],
      }));

    const options = await generateRegistration(userId, auth.session.username, existingCreds);

    // Store challenge
    await supabase.from("auth_challenges").insert({
      user_id: userId,
      challenge: options.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ options });
  } catch (err) {
    console.error("[WebAuthn register] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
