import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";

// ────────────────────────────────────────────────────────────
// GET /api/auth/mfa/status — Check if user has MFA set up
// ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;

    const { data: credentials } = await supabase
      .from("user_credentials")
      .select("id, credential_type, name, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    const methods = (credentials ?? []).map((c) => ({
      id: c.id,
      type: c.credential_type,
      name: c.name,
      created_at: c.created_at,
    }));

    return NextResponse.json({
      enabled: methods.length > 0,
      methods,
      hasWebauthn: methods.some((m) => m.type === "webauthn"),
      hasTotp: methods.some((m) => m.type === "totp"),
    });
  } catch (err) {
    console.error("[MFA status] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
