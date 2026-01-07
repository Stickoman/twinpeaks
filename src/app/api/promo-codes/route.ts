import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { createPromoSchema } from "@/lib/validations/promo";
import { logAudit } from "@/lib/audit";

// GET /api/promo-codes — list all promo codes (admin only)
export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, min_order_amount, max_uses, current_uses, valid_from, valid_until, is_active, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Promo codes fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch promo codes" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/promo-codes — create a new promo code (admin only)
export async function POST(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const body: unknown = await request.json();
  const parsed = createPromoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("promo_codes")
    .insert({
      ...parsed.data,
      created_by: auth.session.userId,
    })
    .select(
      "id, code, discount_type, discount_value, min_order_amount, max_uses, current_uses, valid_from, valid_until, is_active, created_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A promo code with this code already exists" },
        { status: 409 },
      );
    }
    console.error("Promo code create error:", error);
    return NextResponse.json({ error: "Failed to create promo code" }, { status: 500 });
  }

  logAudit({
    action: "promo_code_created",
    entityType: "promo_code",
    entityId: data.id as string,
    actorId: auth.session.userId,
    details: { code: parsed.data.code },
  });

  return NextResponse.json(data, { status: 201 });
}
