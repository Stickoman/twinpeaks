import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/driver/orders/[id] - Get single order assigned to driver
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(
        "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields)",
      )
      .eq("id", id)
      .eq("assigned_driver_id", auth.session.userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      console.error("Error fetching driver order:", error);
      return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
    }

    return NextResponse.json(order);
  } catch (err) {
    console.error("[Driver order GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
