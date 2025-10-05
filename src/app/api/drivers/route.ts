import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createDriverSchema } from "@/lib/validations/driver";

// ────────────────────────────────────────────────────────────
// GET /api/drivers - List all drivers
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, role, phone, vehicle_info, is_active, is_trusted, profile_picture_url, created_at, updated_at",
      )
      .eq("role", "driver")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching drivers:", error);
      return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Drivers GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/drivers - Create a new driver account
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth("super_admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Check if username already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Username already taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const { data: driver, error } = await supabase
      .from("profiles")
      .insert({
        username: parsed.data.username,
        password_hash: passwordHash,
        role: "driver" as const,
        phone: parsed.data.phone ?? null,
        vehicle_info: parsed.data.vehicle_info ?? null,
        is_active: true,
        profile_picture_url: null,
      })
      .select("id, username, role, phone, vehicle_info, is_active, created_at")
      .single();

    if (error) {
      console.error("Error creating driver:", error);
      return NextResponse.json({ error: "Failed to create driver" }, { status: 500 });
    }

    logAudit({
      action: "driver_created",
      entityType: "profile",
      entityId: driver.id,
      actorId: auth.session.userId,
      details: { username: parsed.data.username },
    });

    return NextResponse.json(driver, { status: 201 });
  } catch (err) {
    console.error("[Drivers POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
