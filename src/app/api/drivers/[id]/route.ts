import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { updateDriverSchema } from "@/lib/validations/driver";

// ────────────────────────────────────────────────────────────
// GET /api/drivers/[id] - Get a single driver
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, username, role, phone, vehicle_info, is_active, is_trusted, profile_picture_url, created_at, updated_at",
      )
      .eq("id", id)
      .eq("role", "driver")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Driver not found" }, { status: 404 });
      }
      console.error("Error fetching driver:", error);
      return NextResponse.json({ error: "Failed to fetch driver" }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Driver GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// PUT /api/drivers/[id] - Update a driver
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("super_admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

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
    if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active;
    if (parsed.data.is_trusted !== undefined) updateData.is_trusted = parsed.data.is_trusted;

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", id)
      .eq("role", "driver")
      .select(
        "id, username, role, phone, vehicle_info, is_active, is_trusted, profile_picture_url, created_at, updated_at",
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Driver not found" }, { status: 404 });
      }
      console.error("Error updating driver:", error);
      return NextResponse.json({ error: "Failed to update driver" }, { status: 500 });
    }

    logAudit({
      action: "driver_updated",
      entityType: "profile",
      entityId: id,
      actorId: auth.session.userId,
      details: parsed.data,
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[Driver PUT] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// DELETE /api/drivers/[id] - Delete a driver
// ────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("god_admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    // Unassign all orders from this driver first
    const { error: unassignError } = await supabase
      .from("orders")
      .update({
        assigned_driver_id: null,
        assigned_at: null,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("assigned_driver_id", id)
      .in("status", ["assigned", "en_route"]);

    if (unassignError) {
      console.error("Error unassigning orders:", unassignError);
      return NextResponse.json({ error: "Failed to unassign orders from driver" }, { status: 500 });
    }

    const { error } = await supabase.from("profiles").delete().eq("id", id).eq("role", "driver");

    if (error) {
      console.error("Error deleting driver:", error);
      return NextResponse.json({ error: "Failed to delete driver" }, { status: 500 });
    }

    logAudit({
      action: "driver_deleted",
      entityType: "profile",
      entityId: id,
      actorId: auth.session.userId,
    });

    return NextResponse.json({ message: "Driver deleted successfully" });
  } catch (err) {
    console.error("[Driver DELETE] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
