import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { updateDriverSchema } from "@/lib/validations/driver";

// ────────────────────────────────────────────────────────────
// GET /api/driver/profile - Get current driver profile
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, role, phone, vehicle_info, is_active, profile_picture_url, created_at")
      .eq("id", auth.session.userId)
      .single();

    if (error) {
      console.error("Error fetching driver profile:", error);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Driver profile GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// PUT /api/driver/profile - Update current driver profile
// ────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = updateDriverSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone;
    if (parsed.data.vehicle_info !== undefined) updateData.vehicle_info = parsed.data.vehicle_info;
    // Drivers cannot change their own is_active status

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", auth.session.userId)
      .select("id, username, role, phone, vehicle_info, is_active, profile_picture_url, created_at")
      .single();

    if (error) {
      console.error("Error updating driver profile:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Driver profile PUT] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
