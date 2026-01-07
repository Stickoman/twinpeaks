import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyPromoSchema } from "@/lib/validations/promo";
import { checkRateLimit } from "@/lib/rate-limit";
import { hashIp } from "@/lib/utils/hash-ip";

// POST /api/promo-codes/validate — public endpoint to validate a promo code
export async function POST(request: Request) {
  const rawIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const clientIp = hashIp(rawIp);

  const rateLimitResult = await checkRateLimit(`promo:validate:${clientIp}`, 10, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const body: unknown = await request.json();
  const parsed = applyPromoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { code, subtotal } = parsed.data;
  const supabase = createServiceClient();

  const { data: promo, error } = await supabase
    .from("promo_codes")
    .select(
      "id, code, discount_type, discount_value, min_order_amount, max_uses, current_uses, valid_from, valid_until, is_active",
    )
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .single();

  if (error || !promo) {
    return NextResponse.json(
      { error: "Invalid promo code", code: "INVALID_CODE" },
      { status: 404 },
    );
  }

  // Check validity period
  const now = new Date();
  if (promo.valid_from && new Date(promo.valid_from as string) > now) {
    return NextResponse.json(
      { error: "This promo code is not yet active", code: "NOT_YET_ACTIVE" },
      { status: 400 },
    );
  }

  if (promo.valid_until && new Date(promo.valid_until as string) < now) {
    return NextResponse.json(
      { error: "This promo code has expired", code: "EXPIRED" },
      { status: 410 },
    );
  }

  // Check max uses
  if (promo.max_uses !== null && (promo.current_uses as number) >= (promo.max_uses as number)) {
    return NextResponse.json(
      { error: "This promo code has been fully redeemed", code: "MAX_USES_REACHED" },
      { status: 410 },
    );
  }

  // Check minimum order amount
  if (subtotal < (promo.min_order_amount as number)) {
    return NextResponse.json(
      {
        error: `Minimum order amount of $${promo.min_order_amount} required for this code`,
        code: "MIN_ORDER_NOT_MET",
      },
      { status: 400 },
    );
  }

  // Calculate discount
  let discountAmount: number;
  if (promo.discount_type === "percentage") {
    discountAmount = Math.round(subtotal * ((promo.discount_value as number) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(promo.discount_value as number, subtotal);
  }

  return NextResponse.json({
    valid: true,
    promo_code_id: promo.id,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    discount_amount: discountAmount,
    new_total: Math.max(0, subtotal - discountAmount),
  });
}
