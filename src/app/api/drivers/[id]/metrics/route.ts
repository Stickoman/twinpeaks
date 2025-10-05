import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/drivers/[id]/metrics - Driver performance metrics
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    // Verify driver exists
    const { data: driver } = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .eq("id", id)
      .eq("role", "driver")
      .single();

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    // Fetch all delivered orders for this driver
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, delivery_fee, assigned_at, delivered_at, status")
      .eq("assigned_driver_id", id);

    const allOrders = orders ?? [];
    const delivered = allOrders.filter((o) => o.status === "delivered");
    const totalOrders = allOrders.length;
    const completedOrders = delivered.length;
    const cancelledOrders = allOrders.filter((o) => o.status === "cancelled").length;
    const totalRevenue = delivered.reduce((sum, o) => sum + (o.total ?? 0), 0);
    const totalDeliveryFees = delivered.reduce((sum, o) => sum + (o.delivery_fee ?? 0), 0);

    // Average delivery time (minutes)
    const deliveryTimes = delivered
      .filter((o) => o.assigned_at && o.delivered_at)
      .map((o) => {
        const start = new Date(o.assigned_at!).getTime();
        const end = new Date(o.delivered_at!).getTime();
        return (end - start) / 60_000;
      })
      .filter((t) => t > 0 && t < 480); // Filter outliers (< 8 hours)

    const avgDeliveryTime =
      deliveryTimes.length > 0
        ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
        : 0;

    // Fetch delivery routes for distance
    const { data: routes } = await supabase
      .from("delivery_routes")
      .select("distance_km")
      .eq("driver_id", id);

    const totalDistance = (routes ?? []).reduce((sum, r) => sum + (r.distance_km ?? 0), 0);

    // Fetch shifts
    const { data: shifts } = await supabase
      .from("driver_shifts")
      .select("id, started_at, ended_at, orders_completed, total_distance_km, total_revenue")
      .eq("driver_id", id)
      .order("started_at", { ascending: false })
      .limit(30);

    const completedShifts = (shifts ?? []).filter((s) => s.ended_at);
    const avgOrdersPerShift =
      completedShifts.length > 0
        ? Math.round(
            (completedShifts.reduce((sum, s) => sum + (s.orders_completed ?? 0), 0) /
              completedShifts.length) *
              10,
          ) / 10
        : 0;

    // Orders by day (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const ordersByDay = Array.from({ length: 14 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (13 - i));
      const dateStr = date.toISOString().split("T")[0];
      const count = delivered.filter(
        (o) => o.delivered_at && o.delivered_at.startsWith(dateStr),
      ).length;
      return { date: dateStr, count };
    });

    return NextResponse.json({
      totalOrders,
      completedOrders,
      cancelledOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalDeliveryFees: Math.round(totalDeliveryFees * 100) / 100,
      avgDeliveryTime,
      totalDistance: Math.round(totalDistance * 10) / 10,
      totalShifts: completedShifts.length,
      avgOrdersPerShift,
      ordersByDay,
      recentShifts: (shifts ?? []).slice(0, 10),
    });
  } catch (err) {
    console.error("[Driver metrics] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
