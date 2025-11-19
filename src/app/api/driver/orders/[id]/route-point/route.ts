import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";

const routePointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// POST /api/driver/orders/[id]/route-point — append a GPS breadcrumb
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { id: orderId } = await params;
  const body: unknown = await request.json();
  const parsed = routePointSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Verify order is assigned to this driver and en_route
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, assigned_driver_id")
    .eq("id", orderId)
    .single();

  if (!order || order.assigned_driver_id !== auth.session.userId) {
    return NextResponse.json({ error: "Order not found or not assigned to you" }, { status: 404 });
  }

  if (order.status !== "en_route") {
    return NextResponse.json(
      { error: "Can only record route points for en_route orders" },
      { status: 400 },
    );
  }

  // Find or create delivery route record
  const { data: existingRoute } = await supabase
    .from("delivery_routes")
    .select("id, route_points")
    .eq("order_id", orderId)
    .eq("driver_id", auth.session.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newPoint = {
    lat: parsed.data.latitude,
    lng: parsed.data.longitude,
    timestamp: new Date().toISOString(),
  };

  if (existingRoute) {
    // Append point to existing route
    const currentPoints = (existingRoute.route_points as unknown[]) ?? [];
    const { error } = await supabase
      .from("delivery_routes")
      .update({
        route_points: [...currentPoints, newPoint],
      })
      .eq("id", existingRoute.id);

    if (error) {
      console.error("Error appending route point:", error);
      return NextResponse.json({ error: "Failed to record route point" }, { status: 500 });
    }
  } else {
    // Create new route record
    const { error } = await supabase.from("delivery_routes").insert({
      order_id: orderId,
      driver_id: auth.session.userId,
      route_points: [newPoint],
      started_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error creating delivery route:", error);
      return NextResponse.json({ error: "Failed to create route record" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "Route point recorded" });
}
