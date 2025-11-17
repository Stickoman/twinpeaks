import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { isValidStatusTransition } from "@/lib/validations/driver";
import { sendPushNotification } from "@/lib/push";

// ────────────────────────────────────────────────────────────
// POST /api/driver/orders/[id]/start - Mark order as en_route
// ────────────────────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    // Verify order is assigned to this driver
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, assigned_driver_id")
      .eq("id", id)
      .eq("assigned_driver_id", auth.session.userId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "Order not found or not assigned to you" },
        { status: 404 },
      );
    }

    if (!isValidStatusTransition(order.status, "en_route")) {
      return NextResponse.json(
        { error: `Cannot transition from '${order.status}' to 'en_route'` },
        { status: 400 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "en_route",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error starting delivery:", updateError);
      return NextResponse.json({ error: "Failed to start delivery" }, { status: 500 });
    }

    logAudit({
      action: "order_en_route",
      entityType: "order",
      entityId: id,
      actorId: auth.session.userId,
    });

    // Send push notification to customer
    try {
      const { data: subs } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("order_id", id);

      if (subs && subs.length > 0) {
        await Promise.allSettled(
          subs.map((sub) =>
            sendPushNotification(sub, {
              title: "Driver is on the way!",
              body: "Your delivery is being prepared and the driver has started heading to you.",
              tag: `order-${id}-start`,
            }),
          ),
        );
      }
    } catch (pushErr) {
      console.error("Push notification error:", pushErr);
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Driver order start POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
