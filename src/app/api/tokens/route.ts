import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createTokenSchema } from "@/lib/validations/tokens";
import { generateSecureToken, getTokenExpiry } from "@/lib/utils/helpers";
import { TOKEN_TTL_MINUTES } from "@/lib/utils/constants";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import type { SecureToken } from "@/types/database";

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("secure_tokens")
      .select("id, token, grade, expires_at, used, access_attempts, locked, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Tokens fetch error:", error);
      return NextResponse.json({ error: "Failed to fetch tokens." }, { status: 500 });
    }

    return NextResponse.json(data as SecureToken[]);
  } catch (err) {
    console.error("Tokens GET error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const token = generateSecureToken();
    const expiresAt = getTokenExpiry();

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("secure_tokens")
      .insert({
        token,
        grade: parsed.data.grade,
        expires_at: expiresAt.toISOString(),
        used: false,
        fingerprint: null,
        ip_address: null,
        access_attempts: 0,
        locked: false,
      })
      .select()
      .single();

    if (error) {
      console.error("Token create error:", error);
      return NextResponse.json({ error: "Failed to create token." }, { status: 500 });
    }

    const tokenData = data as SecureToken;

    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";

    const fullUrl = `${baseUrl}/form/${tokenData.token}`;

    logAudit({
      action: "token_created",
      entityType: "token",
      entityId: tokenData.id,
      actorId: auth.session.userId,
      details: { grade: parsed.data.grade },
    });

    return NextResponse.json(
      {
        ...tokenData,
        url: fullUrl,
        ttl_minutes: TOKEN_TTL_MINUTES,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Token POST error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
