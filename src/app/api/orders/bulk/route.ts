import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { bulkUpdateOrderStatusSchema } from "@/lib/validations/orders";

export async function PUT(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const body: unknown = await request.json();
  const parsed = bulkUpdateOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { ids, status } = parsed.data;
  const supabase = createServiceClient();

  // Restore stock for orders being cancelled
  if (status === "cancelled") {
    const { data: currentOrders } = await supabase
      .from("orders")
      .select("id, status")
      .in("id", ids)
      .neq("status", "cancelled");

    if (currentOrders) {
      for (const order of currentOrders) {
        const { error: restoreError } = await supabase.rpc("restore_stock", {
          p_order_id: order.id,
        });
        if (restoreError) {
          console.error(`Error restoring stock for order ${order.id}:`, restoreError);
        }
      }
    }
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", ids)
    .select();

  if (error) {
    return NextResponse.json({ error: "Failed to update orders" }, { status: 500 });
  }

  logAudit({
    action: "bulk_orders_status_updated",
    entityType: "order",
    actorId: auth.session.userId,
    details: { count: data.length, status },
  });

  return NextResponse.json({ updated: data.length, status });
}
