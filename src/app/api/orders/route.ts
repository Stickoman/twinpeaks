import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { updateOrderStatusSchema } from "@/lib/validations/orders";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import type { OrderWithItems } from "@/types/database";
import { z } from "zod";

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields)",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch orders." }, { status: 500 });
    }

    return NextResponse.json(data as OrderWithItems[]);
  } catch (err) {
    console.error("[Orders GET] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();

    const parsed = updateOrderStatusSchema.extend({ id: z.string().uuid() }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("orders")
      .update({ status: parsed.data.status })
      .eq("id", parsed.data.id)
      .select(
        "id, address, status, grade, token_id, notes, assigned_driver_id, assigned_at, delivered_at, latitude, longitude, subtotal, delivery_fee, total, delivery_code, promo_code_id, discount_amount, created_at, updated_at, order_items(id, order_id, item_id, name, variety, quantity, unit, unit_price, category_slug, custom_fields)",
      )
      .single();

    if (error) {
      console.error("Order update error:", error);
      return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
    }

    logAudit({
      action: "order_status_changed",
      entityType: "order",
      entityId: parsed.data.id,
      actorId: auth.session.userId,
      details: { status: parsed.data.status },
    });

    return NextResponse.json(data as OrderWithItems);
  } catch (err) {
    console.error("[Orders PUT] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
