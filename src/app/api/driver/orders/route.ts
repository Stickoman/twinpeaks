import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/driver/orders - List orders for current driver
// Includes assigned + en_route orders, plus pending unassigned
// orders if the driver is trusted.
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    // Check for active shift — if one exists, only show orders assigned during it
    const { data: activeShift } = await supabase
      .from("driver_shifts")
      .select("id, started_at")
      .eq("driver_id", auth.session.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch driver's assigned orders
    let assignedQuery = supabase
      .from("orders")
      .select(
        "id, address, status, grade, notes, subtotal, delivery_fee, total, delivery_code, assigned_driver_id, assigned_at, latitude, longitude, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price)",
      )
      .eq("assigned_driver_id", auth.session.userId)
      .in("status", ["assigned", "en_route"])
      .order("assigned_at", { ascending: true });

    // If there's an active shift, only show orders from that shift onwards
    if (activeShift) {
      assignedQuery = assignedQuery.gte("assigned_at", activeShift.started_at);
    }

    const { data: assignedOrders, error: assignedError } = await assignedQuery;

    if (assignedError) {
      console.error("Error fetching driver orders:", assignedError);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    // Check if driver is trusted — if so, include pending unassigned orders
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_trusted")
      .eq("id", auth.session.userId)
      .single();

    let pendingOrders: typeof assignedOrders = [];

    if (profile?.is_trusted) {
      const { data: pending, error: pendingError } = await supabase
        .from("orders")
        .select(
          "id, address, status, grade, notes, subtotal, delivery_fee, total, delivery_code, assigned_driver_id, assigned_at, latitude, longitude, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price)",
        )
        .eq("status", "pending")
        .is("assigned_driver_id", null)
        .order("created_at", { ascending: true });

      if (!pendingError && pending) {
        pendingOrders = pending;
      }
    }

    return NextResponse.json({
      assigned: assignedOrders,
      pending: pendingOrders,
      is_trusted: profile?.is_trusted ?? false,
    });
  } catch (err) {
    console.error("[Driver orders GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
