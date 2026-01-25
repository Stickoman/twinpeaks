import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateAuthentication, type StoredCredential } from "@/lib/webauthn";

// ────────────────────────────────────────────────────────────
// POST /api/auth/webauthn/authenticate — Generate auth options
// ────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;

    // Get stored WebAuthn credentials
    const { data: credentials } = await supabase
      .from("user_credentials")
      .select("credential_id, public_key, counter, transports")
      .eq("user_id", userId)
      .eq("credential_type", "webauthn");

    if (!credentials || credentials.length === 0) {
      return NextResponse.json({ error: "No WebAuthn credentials found" }, { status: 404 });
    }

    const stored: StoredCredential[] = credentials
      .filter((c) => c.credential_id && c.public_key)
      .map((c) => ({
        credentialID: c.credential_id!,
        publicKey: c.public_key!,
        counter: c.counter ?? 0,
        transports: c.transports ?? [],
      }));

    const options = await generateAuthentication(stored);

    // Store challenge
    await supabase.from("auth_challenges").insert({
      user_id: userId,
      challenge: options.challenge,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });

    return NextResponse.json({ options });
  } catch (err) {
    console.error("[WebAuthn authenticate] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
