import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { updateOrderStatusSchema } from "@/lib/validations/orders";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { sanitizeText } from "@/lib/utils/sanitize";
import { z } from "zod";

// ────────────────────────────────────────────────────────────
// Update order schema (status + optional notes)
// ────────────────────────────────────────────────────────────

const updateOrderSchema = z
  .object({
    status: updateOrderStatusSchema.shape.status.optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => data.status !== undefined || data.notes !== undefined, {
    message: "At least one of status or notes must be provided",
  });

// ────────────────────────────────────────────────────────────
// GET /api/orders/[id] - Fetch an order with its items
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (orderError) {
    if (orderError.code === "PGRST116") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.error("Error fetching order:", orderError);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select(
      "id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields",
    )
    .eq("order_id", id);

  if (itemsError) {
    console.error("Error fetching order items:", itemsError);
    return NextResponse.json({ error: "Failed to fetch order items" }, { status: 500 });
  }

  // Fetch delivery proof if order is delivered
  let deliveryProof = null;
  if (order.status === "delivered") {
    const { data: proof } = await supabase
      .from("delivery_proofs")
      .select("id, order_id, driver_id, photo_url, notes, latitude, longitude, created_at")
      .eq("order_id", id)
      .single();
    deliveryProof = proof;
  }

  return NextResponse.json({
    ...order,
    items: orderItems,
    order_items: orderItems,
    delivery_proof: deliveryProof,
  });
}

// ────────────────────────────────────────────────────────────
// PUT /api/orders/[id] - Update an order (PATCH semantics)
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // If cancelling, fetch current status first to check if stock should be restored
  if (parsed.data.status === "cancelled") {
    const { data: currentOrder } = await supabase
      .from("orders")
      .select("status")
      .eq("id", id)
      .single();

    if (currentOrder && currentOrder.status !== "cancelled") {
      // Restore stock when cancelling
      const { error: restoreError } = await supabase.rpc("restore_stock", {
        p_order_id: id,
      });

      if (restoreError) {
        console.error("Error restoring stock:", restoreError);
      }
    }
  }

  const updateData = {
    ...parsed.data,
    ...(parsed.data.notes ? { notes: sanitizeText(parsed.data.notes) } : {}),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    console.error("Error updating order:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }

  logAudit({
    action: "order_updated",
    entityType: "order",
    entityId: id,
    actorId: auth.session.userId,
    details: parsed.data,
  });

  return NextResponse.json(data);
}

// ────────────────────────────────────────────────────────────
// DELETE /api/orders/[id] - Delete an order
// ────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  // Restore stock if the order wasn't already cancelled or delivered
  const { data: currentOrder } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();

  if (currentOrder && currentOrder.status !== "cancelled" && currentOrder.status !== "delivered") {
    const { error: restoreError } = await supabase.rpc("restore_stock", {
      p_order_id: id,
    });

    if (restoreError) {
      console.error("Error restoring stock on delete:", restoreError);
    }
  }

  // Delete order items first
  const { error: itemsError } = await supabase.from("order_items").delete().eq("order_id", id);

  if (itemsError) {
    console.error("Error deleting order items:", itemsError);
    return NextResponse.json({ error: "Failed to delete order items" }, { status: 500 });
  }

  const { error: orderError } = await supabase.from("orders").delete().eq("id", id);

  if (orderError) {
    console.error("Error deleting order:", orderError);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }

  logAudit({
    action: "order_deleted",
    entityType: "order",
    entityId: id,
    actorId: auth.session.userId,
  });

  return NextResponse.json({ message: "Order deleted successfully" }, { status: 200 });
}
