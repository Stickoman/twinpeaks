import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const paramsSchema = z.object({ id: z.string().uuid() });

// POST /api/driver/orders/[id]/self-assign — trusted driver self-assigns a pending order
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order ID" }, { status: 400 });
  }

  const orderId = parsed.data.id;
  const supabase = createServiceClient();

  // Check if driver is trusted
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_trusted")
    .eq("id", auth.session.userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Driver profile not found" }, { status: 404 });
  }

  if (!profile.is_trusted) {
    return NextResponse.json(
      { error: "Only trusted drivers can self-assign orders" },
      { status: 403 },
    );
  }

  // Check order is pending and unassigned
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, assigned_driver_id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "pending") {
    return NextResponse.json({ error: "Order is not in pending status" }, { status: 400 });
  }

  if (order.assigned_driver_id) {
    return NextResponse.json({ error: "Order is already assigned" }, { status: 409 });
  }

  // Assign the order
  const { error: updateError } = await supabase
    .from("orders")
    .update({
      assigned_driver_id: auth.session.userId,
      status: "assigned",
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (updateError) {
    console.error("Self-assign error:", updateError);
    return NextResponse.json({ error: "Failed to assign order" }, { status: 500 });
  }

  logAudit({
    action: "order_self_assigned",
    entityType: "order",
    entityId: orderId,
    actorId: auth.session.userId,
  });

  return NextResponse.json({ message: "Order assigned successfully" });
}
