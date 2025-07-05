import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { comparePassword, signToken, COOKIE_NAME, cookieOptions } from "@/lib/auth";
import type { UserRole } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/utils/hash-ip";

const loginSchema = z.object({
  username: z.string().min(1).max(50).trim(),
  password: z.string().min(1).max(200),
});

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
  );
}

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid credentials" },
        { status: 400 },
      );
    }

    const { username, password } = parsed.data;

    const ip = await getClientIp();
    const hashedIp = ip ? hashIp(ip) : "unknown";
    const rateLimitResult = await checkRateLimit(`auth:login:${hashedIp}`, 10, 300);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    }

    const supabase = getServiceClient();
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("id, username, password_hash, role")
      .eq("username", username)
      .single();

    if (dbError || !profile) {
      logAudit({
        action: "login_failed",
        entityType: "auth",
        details: { username, reason: "user_not_found" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const passwordValid = await comparePassword(password, profile.password_hash);

    if (!passwordValid) {
      logAudit({
        action: "login_failed",
        entityType: "auth",
        actorId: profile.id,
        details: { username, reason: "invalid_password" },
        ipAddress: ip,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const role = profile.role as UserRole;
    const token = await signToken({
      userId: profile.id,
      role,
      username: profile.username,
    });

    logAudit({
      action: "login_success",
      entityType: "auth",
      actorId: profile.id,
      details: { username, role },
      ipAddress: ip,
    });

    const redirect = role === "driver" ? "/driver" : "/";
    const response = NextResponse.json({
      success: true,
      role,
      redirect,
    });

    response.cookies.set(COOKIE_NAME, token, cookieOptions);

    return response;
  } catch (err) {
    console.error("[Auth login POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
