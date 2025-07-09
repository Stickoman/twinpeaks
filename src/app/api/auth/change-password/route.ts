import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { comparePassword, hashPassword } from "@/lib/auth";
import { requireAuth } from "@/lib/api-auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { changePasswordSchema } from "@/lib/validations/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/utils/hash-ip";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { allowed } = await checkRateLimit(`auth:change-password:${auth.session.userId}`, 5, 300);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid data" },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const supabase = createServiceClient();

    // Fetch current password hash
    const { data: profile, error: fetchError } = await supabase
      .from("profiles")
      .select("password_hash")
      .eq("id", auth.session.userId)
      .single();

    if (fetchError || !profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const isValid = await comparePassword(currentPassword, profile.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auth.session.userId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    const ip = await getClientIp();
    logAudit({
      action: "password_changed",
      entityType: "auth",
      actorId: auth.session.userId,
      ipAddress: ip ? hashIp(ip) : null,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Auth change-password POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
