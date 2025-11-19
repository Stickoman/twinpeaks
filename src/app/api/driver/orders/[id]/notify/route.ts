import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { sendPushNotification } from "@/lib/push";

// ────────────────────────────────────────────────────────────
// POST /api/driver/orders/[id]/notify - Send ETA notification
// ────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const body = (await request.json()) as { message?: string };
    const message = body.message || "Your driver is arriving in about 5 minutes!";

    const supabase = createServiceClient();

    // Verify order is assigned to this driver and is en_route
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

    if (order.status !== "en_route") {
      return NextResponse.json({ error: "Can only notify for en_route orders" }, { status: 400 });
    }

    // Send push notification to customer
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("order_id", id);

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: false, reason: "No push subscription found" });
    }

    const results = await Promise.allSettled(
      subs.map((sub) =>
        sendPushNotification(sub, {
          title: "Driver Update",
          body: message,
          tag: `order-${id}-eta`,
        }),
      ),
    );

    const sent = results.some((r) => r.status === "fulfilled" && r.value === true);

    return NextResponse.json({ sent });
  } catch (err) {
    console.error("[Driver notify POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
