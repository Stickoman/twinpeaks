import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/orders/[id]/delivery-route - Get delivery route for an order
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const auth = await requireAuth();
    if (!auth.authenticated) return auth.response;

    const { id } = await params;

    const supabase = createServiceClient();

    const { data: route, error } = await supabase
      .from("delivery_routes")
      .select(
        "id, order_id, driver_id, route_points, started_at, completed_at, distance_km, created_at",
      )
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching delivery route:", error);
      return NextResponse.json({ error: "Failed to fetch route" }, { status: 500 });
    }

    if (!route) {
      return NextResponse.json({ route: null });
    }

    return NextResponse.json({ route });
  } catch (err) {
    console.error("Delivery route GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
