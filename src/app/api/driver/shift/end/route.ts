import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { endShiftSchema } from "@/lib/validations/shift";

// ────────────────────────────────────────────────────────────
// POST /api/driver/shift/end - End the current active shift
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = endShiftSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Find active shift
    const { data: shift, error: fetchError } = await supabase
      .from("driver_shifts")
      .select("id, started_at")
      .eq("driver_id", auth.session.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !shift) {
      return NextResponse.json({ error: "No active shift found" }, { status: 404 });
    }

    // Count orders completed during this shift
    const { count: ordersCompleted } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("assigned_driver_id", auth.session.userId)
      .eq("status", "delivered")
      .gte("delivered_at", shift.started_at);

    // Calculate total distance from delivery routes during shift
    const { data: routes } = await supabase
      .from("delivery_routes")
      .select("distance_km")
      .eq("driver_id", auth.session.userId)
      .gte("started_at", shift.started_at);

    const totalDistanceKm = routes?.reduce((sum, r) => sum + (r.distance_km ?? 0), 0) ?? 0;

    // Calculate total revenue from delivered orders during shift
    const { data: deliveredOrders } = await supabase
      .from("orders")
      .select("total")
      .eq("assigned_driver_id", auth.session.userId)
      .eq("status", "delivered")
      .gte("delivered_at", shift.started_at);

    const totalRevenue = deliveredOrders?.reduce((sum, o) => sum + (o.total ?? 0), 0) ?? 0;

    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("driver_shifts")
      .update({
        ended_at: now,
        orders_completed: ordersCompleted ?? 0,
        total_distance_km: Math.round(totalDistanceKm * 100) / 100,
        total_revenue: Math.round(totalRevenue * 100) / 100,
        notes: parsed.data.notes ?? null,
      })
      .eq("id", shift.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error ending shift:", updateError);
      return NextResponse.json({ error: "Failed to end shift" }, { status: 500 });
    }

    logAudit({
      action: "shift_ended",
      entityType: "driver_shift",
      entityId: shift.id,
      actorId: auth.session.userId,
      details: {
        orders_completed: ordersCompleted ?? 0,
        total_distance_km: totalDistanceKm,
        total_revenue: totalRevenue,
      },
    });

    return NextResponse.json({ shift: updated });
  } catch (err) {
    console.error("[Driver shift end POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
