import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { routeOptimizeSchema } from "@/lib/validations/driver";
import { optimizeDeliveryRoute, getRoutePolylines } from "@/lib/utils/route-optimizer";

// ────────────────────────────────────────────────────────────
// POST /api/driver/route-optimize - Optimize delivery route
// Uses OSRM for real road distances, falls back to nearest-neighbor
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = routeOptimizeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Get driver's latest location as start point
    const { data: location } = await supabase
      .from("driver_locations")
      .select("latitude, longitude")
      .eq("driver_id", auth.session.userId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .single();

    const start = {
      latitude: location?.latitude ?? 0,
      longitude: location?.longitude ?? 0,
    };

    // Fetch the requested orders
    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, address, latitude, longitude")
      .in("id", parsed.data.order_ids)
      .eq("assigned_driver_id", auth.session.userId);

    if (error) {
      console.error("Error fetching orders for optimization:", error);
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: "No matching orders found" }, { status: 404 });
    }

    const result = await optimizeDeliveryRoute(
      start,
      orders.map((o) => ({
        id: o.id as string,
        address: o.address as string,
        latitude: o.latitude as number,
        longitude: o.longitude as number,
      })),
    );

    // Get real road polylines + ETAs from Google Directions
    const polylines = await getRoutePolylines(start, result.order, result.source);

    return NextResponse.json({
      optimized_order: result.order.map((o) => o.id),
      orders: result.order,
      total_distance_km: result.total_distance_km,
      source: result.source,
      // Enriched data from Google Directions (may be null if API fails)
      polyline: polylines?.polyline ?? null,
      legs: polylines?.legs ?? null,
      total_distance_m: polylines?.total_distance_m ?? null,
      total_duration_seconds: polylines?.total_duration_seconds ?? null,
    });
  } catch (err) {
    console.error("[Driver route-optimize POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
