import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { confirmDeliverySchema, isValidStatusTransition } from "@/lib/validations/driver";
import { haversineDistanceKm } from "@/lib/utils/geo";

// ────────────────────────────────────────────────────────────
// POST /api/driver/orders/[id]/confirm - Confirm delivery with proof
// ────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const body: unknown = await request.json();
    const parsed = confirmDeliverySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify order is assigned to this driver and in valid state
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, status, assigned_driver_id, assigned_at, created_at, delivery_code")
      .eq("id", id)
      .eq("assigned_driver_id", auth.session.userId)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "Order not found or not assigned to you" },
        { status: 404 },
      );
    }

    if (!isValidStatusTransition(order.status, "delivered")) {
      return NextResponse.json(
        { error: `Cannot transition from '${order.status}' to 'delivered'` },
        { status: 400 },
      );
    }

    // Validate delivery code
    if (order.delivery_code && parsed.data.delivery_code !== order.delivery_code) {
      return NextResponse.json({ error: "Invalid delivery code" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Update order status to delivered
    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({
        status: "delivered",
        delivered_at: now,
        delivery_lat: parsed.data.latitude,
        delivery_lng: parsed.data.longitude,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error confirming delivery:", updateError);
      return NextResponse.json({ error: "Failed to confirm delivery" }, { status: 500 });
    }

    // Create delivery proof record
    const { error: proofError } = await supabase.from("delivery_proofs").insert({
      order_id: id,
      driver_id: auth.session.userId,
      photo_url: parsed.data.photo_url ?? null,
      notes: parsed.data.notes ?? null,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
    });

    if (proofError) {
      console.error("Error saving delivery proof:", proofError);
    }

    // Save delivery route from driver_locations
    try {
      const { data: locations } = await supabase
        .from("driver_locations")
        .select("latitude, longitude, recorded_at")
        .eq("driver_id", auth.session.userId)
        .gte("recorded_at", order.assigned_at ?? order.created_at)
        .order("recorded_at", { ascending: true });

      if (locations && locations.length > 0) {
        const routePoints = locations.map((loc) => ({
          lat: loc.latitude,
          lng: loc.longitude,
          timestamp: loc.recorded_at,
        }));

        let distanceKm = 0;
        for (let i = 1; i < routePoints.length; i++) {
          const prev = routePoints[i - 1];
          const curr = routePoints[i];
          distanceKm += haversineDistanceKm(prev.lat, prev.lng, curr.lat, curr.lng);
        }

        await supabase.from("delivery_routes").insert({
          order_id: id,
          driver_id: auth.session.userId,
          route_points: routePoints,
          started_at: locations[0].recorded_at,
          completed_at: now,
          distance_km: Math.round(distanceKm * 100) / 100,
        });
      }
    } catch (routeErr) {
      console.error("Error saving delivery route:", routeErr);
    }

    // Clean up push subscriptions (zero trace)
    await supabase.from("push_subscriptions").delete().eq("order_id", id);

    logAudit({
      action: "order_delivered",
      entityType: "order",
      entityId: id,
      actorId: auth.session.userId,
      details: {
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        has_photo: !!parsed.data.photo_url,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[Driver order confirm POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
