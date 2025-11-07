import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/driver/history — completed deliveries for current driver
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, address, grade, status, created_at, delivered_at, order_items(id)")
      .eq("assigned_driver_id", auth.session.userId)
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[Driver history GET] error:", error);
      return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
    }

    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - now.getDay(),
    ).toISOString();

    const todayCount = (orders ?? []).filter(
      (o) => o.delivered_at && o.delivered_at >= todayStart,
    ).length;
    const weekCount = (orders ?? []).filter(
      (o) => o.delivered_at && o.delivered_at >= weekStart,
    ).length;

    // Fetch recent shifts for grouping
    const { data: shifts } = await supabase
      .from("driver_shifts")
      .select("id, started_at, ended_at, orders_completed, total_distance_km, total_revenue")
      .eq("driver_id", auth.session.userId)
      .not("ended_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      deliveries: orders ?? [],
      shifts: shifts ?? [],
      stats: {
        today: todayCount,
        this_week: weekCount,
        all_time: (orders ?? []).length,
      },
    });
  } catch (err) {
    console.error("[Driver history GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
