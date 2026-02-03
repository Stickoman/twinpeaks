import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { pushSubscriptionSchema } from "@/lib/validations/push";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/utils/hash-ip";

// ────────────────────────────────────────────────────────────
// POST /api/push/subscribe - Store push subscription for an order
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Rate limit: 10 requests per 5 minutes per IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { allowed } = await checkRateLimit(`push:subscribe:${hashIp(ip)}`, 10, 300);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body: unknown = await request.json();
    const parsed = pushSubscriptionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify the order exists and is not already delivered
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", parsed.data.order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      return NextResponse.json({ error: "Order already completed" }, { status: 400 });
    }

    // Upsert subscription (one per order per endpoint)
    const { error: insertError } = await supabase.from("push_subscriptions").upsert(
      {
        order_id: parsed.data.order_id,
        endpoint: parsed.data.endpoint,
        p256dh: parsed.data.p256dh,
        auth: parsed.data.auth,
      },
      { onConflict: "order_id, endpoint" },
    );

    if (insertError) {
      console.error("Error storing push subscription:", insertError);
      return NextResponse.json({ error: "Failed to store subscription" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Push subscribe POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
