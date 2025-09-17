import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────
// POST /api/orders/[id]/unassign - Remove driver assignment
// ────────────────────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    // Verify the order exists and has a driver
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, assigned_driver_id")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.assigned_driver_id) {
      return NextResponse.json({ error: "Order is not assigned to any driver" }, { status: 400 });
    }

    // Only allow unassign if order is still in assigned state (not en_route or delivered)
    if (order.status === "delivered") {
      return NextResponse.json({ error: "Cannot unassign a delivered order" }, { status: 400 });
    }

    if (order.status === "en_route") {
      return NextResponse.json(
        { error: "Cannot unassign an order that is en route. Cancel it first." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const previousDriverId = order.assigned_driver_id;

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        assigned_driver_id: null,
        assigned_at: null,
        status: "pending",
        updated_at: now,
      })
      .eq("id", id)
      .select(
        "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields)",
      )
      .single();

    if (updateError) {
      console.error("Error unassigning order:", updateError);
      return NextResponse.json({ error: "Failed to unassign order" }, { status: 500 });
    }

    logAudit({
      action: "order_unassigned",
      entityType: "order",
      entityId: id,
      actorId: auth.session.userId,
      details: { previous_driver_id: previousDriverId },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Order unassign POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
