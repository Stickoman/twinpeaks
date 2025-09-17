import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { assignOrderSchema, isValidStatusTransition } from "@/lib/validations/driver";

// ────────────────────────────────────────────────────────────
// POST /api/orders/[id]/assign - Assign order to a driver
// ────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const body: unknown = await request.json();
    const parsed = assignOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify the order exists and is in a valid state
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, assigned_driver_id")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Reassign: order already has a driver — only update the driver, keep current status
    const isReassign = !!order.assigned_driver_id;

    // For first-time assignment, validate the status transition
    if (!isReassign && !isValidStatusTransition(order.status, "assigned")) {
      return NextResponse.json(
        { error: `Cannot assign order with status '${order.status}'` },
        { status: 400 },
      );
    }

    // Cannot reassign delivered or cancelled orders
    if (order.status === "delivered" || order.status === "cancelled") {
      return NextResponse.json(
        { error: `Cannot reassign a ${order.status} order` },
        { status: 400 },
      );
    }

    // Verify the driver exists and is active
    const { data: driver, error: driverError } = await supabase
      .from("profiles")
      .select("id, username, is_active")
      .eq("id", parsed.data.driver_id)
      .eq("role", "driver")
      .single();

    if (driverError || !driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (!driver.is_active) {
      return NextResponse.json({ error: "Driver is not active" }, { status: 400 });
    }

    const now = new Date().toISOString();

    const updatePayload: Record<string, unknown> = {
      assigned_driver_id: parsed.data.driver_id,
      assigned_at: now,
      updated_at: now,
    };

    // Only change status to "assigned" for first-time assignments
    if (!isReassign) {
      updatePayload.status = "assigned";
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select(
        "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields)",
      )
      .single();

    if (updateError) {
      console.error("Error assigning order:", updateError);
      return NextResponse.json({ error: "Failed to assign order" }, { status: 500 });
    }

    logAudit({
      action: "order_assigned",
      entityType: "order",
      entityId: id,
      actorId: auth.session.userId,
      details: { driver_id: parsed.data.driver_id, driver_username: driver.username },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Order assign POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
