import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createOrderSchema } from "@/lib/validations/orders";
import { MAX_ACCESS_ATTEMPTS } from "@/lib/utils/constants";
import { checkRateLimit } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/utils/sanitize";
import { getAppSettings } from "@/lib/utils/settings";
import { haversineDistanceMiles, getDeliveryFee } from "@/lib/utils/geo";
import { hashIp } from "@/lib/utils/hash-ip";
import { convertUnits } from "@/lib/utils/units";
import type { SecureToken, TokenGrade, PublicItem } from "@/types/database";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface TokenValidationError {
  error: string;
  code: string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

function generateDeliveryCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(1000 + (array[0] % 9000));
}

async function validateToken(
  tokenValue: string,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<
  | { valid: true; token: SecureToken }
  | { valid: false; response: NextResponse<TokenValidationError> }
> {
  const { data: token, error } = await supabase
    .from("secure_tokens")
    .select("id, token, grade, expires_at, used, access_attempts, locked")
    .eq("token", tokenValue)
    .single();

  if (error || !token) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: "Link not found", code: "TOKEN_NOT_FOUND" },
        { status: 404 },
      ),
    };
  }

  const typedToken = token as SecureToken;

  if (typedToken.locked) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: "This link has been locked for security reasons", code: "TOKEN_LOCKED" },
        { status: 403 },
      ),
    };
  }

  if (typedToken.used) {
    await incrementAttempts(typedToken, supabase);
    return {
      valid: false,
      response: NextResponse.json(
        { error: "This link has already been used", code: "TOKEN_USED" },
        { status: 410 },
      ),
    };
  }

  if (new Date(typedToken.expires_at).getTime() <= Date.now()) {
    await incrementAttempts(typedToken, supabase);
    return {
      valid: false,
      response: NextResponse.json(
        { error: "This link has expired", code: "TOKEN_EXPIRED" },
        { status: 410 },
      ),
    };
  }

  if (typedToken.access_attempts >= MAX_ACCESS_ATTEMPTS) {
    await supabase.from("secure_tokens").update({ locked: true }).eq("id", typedToken.id);

    return {
      valid: false,
      response: NextResponse.json(
        { error: "Maximum attempts reached. Link locked.", code: "TOKEN_MAX_ATTEMPTS" },
        { status: 403 },
      ),
    };
  }

  return { valid: true, token: typedToken };
}

async function incrementAttempts(
  token: SecureToken,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const newAttempts = token.access_attempts + 1;
  const shouldLock = newAttempts >= MAX_ACCESS_ATTEMPTS;

  await supabase
    .from("secure_tokens")
    .update({
      access_attempts: newAttempts,
      locked: shouldLock || undefined,
    })
    .eq("id", token.id);
}

async function getCategoryIdsForGrade(
  grade: TokenGrade,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<string[] | null> {
  if (grade === "premium") return null;

  const { data: categories } = await supabase
    .from("categories")
    .select("id")
    .eq("is_active", true)
    .eq("grade_visibility", "classic");

  return (categories ?? []).map((c) => c.id as string);
}

// ────────────────────────────────────────────────────────────
// GET /api/tokens/[token] - Validate link and fetch products
// ────────────────────────────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: tokenValue } = await params;
  const clientIp = hashIp(getClientIp(request));

  const rateLimitResult = await checkRateLimit(`token:GET:${clientIp}`, 20, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const supabase = createServiceClient();

  const result = await validateToken(tokenValue, supabase);

  if (!result.valid) {
    return result.response;
  }

  const { token } = result;

  const categoryIds = await getCategoryIdsForGrade(token.grade, supabase);

  let query = supabase
    .from("items")
    .select(
      "id, name, type, variety, quantity, price, unit_measure, image_url, category_id, custom_fields, low_stock_threshold, badges, is_featured",
    )
    .gt("quantity", 0);

  if (categoryIds) {
    if (categoryIds.length > 0) {
      query = query.or(`category_id.in.(${categoryIds.join(",")}),category_id.is.null`);
    } else {
      // No classic-accessible categories exist — only show uncategorized items
      query = query.is("category_id", null);
    }
  }

  const { data: items, error: itemsError } = await query;

  if (itemsError) {
    console.error("Error fetching products:", itemsError);
    return NextResponse.json(
      { error: "Failed to fetch products", code: "FETCH_ERROR" },
      { status: 500 },
    );
  }

  // Fetch pricing tiers for all returned items
  const itemIds = (items ?? []).map((i) => i.id as string);
  const tiersMap = new Map<string, { unit: string; price: number }[]>();

  if (itemIds.length > 0) {
    const { data: allTiers } = await supabase
      .from("pricing_tiers")
      .select("item_id, unit, price, sort_order")
      .in("item_id", itemIds)
      .order("sort_order", { ascending: true });

    for (const tier of allTiers ?? []) {
      const id = tier.item_id as string;
      const existing = tiersMap.get(id) ?? [];
      existing.push({ unit: tier.unit as string, price: Number(tier.price) });
      tiersMap.set(id, existing);
    }
  }

  const publicItems: PublicItem[] = (items ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    variety: item.variety,
    price: item.price,
    unit_measure: item.unit_measure,
    image_url: item.image_url,
    category_id: item.category_id,
    custom_fields: item.custom_fields,
    low_stock_threshold: item.low_stock_threshold,
    quantity_available: item.quantity as number,
    badges: (item.badges as string[]) ?? [],
    is_featured: (item.is_featured as boolean) ?? false,
    pricing_tiers: tiersMap.get(item.id as string) ?? [],
  }));

  // Fetch settings for the client (currency + fee tiers)
  const settings = await getAppSettings(supabase);

  return NextResponse.json({
    grade: token.grade,
    expires_at: token.expires_at,
    items: publicItems,
    settings: {
      currency_symbol: settings.currency_symbol,
      delivery_fee_tiers: settings.delivery_fee_tiers,
    },
  });
}

// ────────────────────────────────────────────────────────────
// POST /api/tokens/[token] - Submit an order via secure link
// ────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token: tokenValue } = await params;
  const clientIp = hashIp(getClientIp(request));

  const rateLimitResult = await checkRateLimit(`token:POST:${clientIp}`, 5, 60);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", code: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const supabase = createServiceClient();

  const result = await validateToken(tokenValue, supabase);

  if (!result.valid) {
    return result.response;
  }

  const { token } = result;

  const body: unknown = await request.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order data", details: parsed.error.flatten(), code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const { address, items, notes, latitude, longitude } = parsed.data;

  // Fetch app settings
  const settings = await getAppSettings(supabase);

  // ── Radius check ──────────────────────────────────────────
  let deliveryFee = 0;

  if (latitude !== undefined && longitude !== undefined) {
    const { data: driverLocations } = await supabase
      .from("driver_locations")
      .select("driver_id, latitude, longitude")
      .order("recorded_at", { ascending: false });

    // Deduplicate: keep the latest location per driver
    const latestByDriver = new Map<string, { latitude: number; longitude: number }>();
    for (const loc of driverLocations ?? []) {
      if (!latestByDriver.has(loc.driver_id)) {
        latestByDriver.set(loc.driver_id, {
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
      }
    }

    if (latestByDriver.size > 0) {
      // Find the closest driver
      let closestDistance = Infinity;
      for (const loc of latestByDriver.values()) {
        const dist = haversineDistanceMiles(latitude, longitude, loc.latitude, loc.longitude);
        if (dist < closestDistance) closestDistance = dist;
      }

      // Block if no driver within radius
      if (closestDistance > settings.delivery_radius_miles) {
        return NextResponse.json(
          {
            error: `No driver available within ${settings.delivery_radius_miles} miles of your location`,
            code: "NO_DRIVER_IN_RADIUS",
          },
          { status: 400 },
        );
      }

      // Calculate fee from closest driver distance
      const fee = getDeliveryFee(closestDistance, settings.delivery_fee_tiers);
      deliveryFee = fee ?? 0;
    }
  }

  // ── Fetch prices & stock, validate availability ─────────
  const itemIds = items.map((i) => i.item_id);
  const { data: dbItems, error: priceError } = await supabase
    .from("items")
    .select("id, price, quantity, unit_measure, custom_fields, badges")
    .in("id", itemIds);

  if (priceError || !dbItems) {
    console.error("Error fetching item prices:", priceError);
    return NextResponse.json(
      { error: "Failed to fetch item prices", code: "PRICE_FETCH_ERROR" },
      { status: 500 },
    );
  }

  // Build maps: stock quantity and base unit per item
  const stockMap = new Map(dbItems.map((i) => [i.id as string, Number(i.quantity)]));
  const unitMap = new Map(dbItems.map((i) => [i.id as string, (i.unit_measure as string) || "g"]));

  // Convert ordered quantities to base units, then validate stock
  const insufficientStock = items.filter((item) => {
    const available = stockMap.get(item.item_id) ?? 0;
    const baseUnit = unitMap.get(item.item_id) ?? "g";
    const convertedQty = convertUnits(item.quantity, item.unit, baseUnit);
    return convertedQty > available;
  });

  if (insufficientStock.length > 0) {
    return NextResponse.json(
      {
        error: "Insufficient stock for some items",
        details: insufficientStock.map((item) => {
          const baseUnit = unitMap.get(item.item_id) ?? "g";
          return {
            item_id: item.item_id,
            requested: item.quantity,
            requested_unit: item.unit,
            available: stockMap.get(item.item_id) ?? 0,
            available_unit: baseUnit,
          };
        }),
        code: "INSUFFICIENT_STOCK",
      },
      { status: 409 },
    );
  }

  // Build base price map (with promo discount applied)
  const basePriceMap = new Map(
    dbItems.map((i) => {
      let price = Number(i.price);
      const cf = i.custom_fields as Record<string, unknown> | null;
      const badges = (i.badges as string[]) ?? [];
      const discount = Number(cf?.promo_discount);
      if (badges.includes("PROMO") && discount > 0 && discount < 100) {
        price = Math.round(price * (1 - discount / 100) * 100) / 100;
      }
      return [i.id as string, price];
    }),
  );

  // Fetch pricing tiers for all ordered items to get per-unit prices
  const { data: orderTiers } = await supabase
    .from("pricing_tiers")
    .select("item_id, unit, price")
    .in("item_id", itemIds);

  // Build tier lookup: item_id:unit → price
  const tierPriceMap = new Map<string, number>();
  for (const tier of orderTiers ?? []) {
    tierPriceMap.set(`${tier.item_id}:${tier.unit}`, Number(tier.price));
  }

  // Also apply promo discount to tier prices
  const promoDiscountMap = new Map(
    dbItems.map((i) => {
      const cf = i.custom_fields as Record<string, unknown> | null;
      const badges = (i.badges as string[]) ?? [];
      const discount = Number(cf?.promo_discount);
      const hasPromo = badges.includes("PROMO") && discount > 0 && discount < 100;
      return [i.id as string, hasPromo ? discount : 0];
    }),
  );

  let subtotal = 0;
  const itemsWithPrices = items.map((item) => {
    // Look up tier price for the specific unit, fallback to base price
    let unitPrice =
      tierPriceMap.get(`${item.item_id}:${item.unit}`) ?? basePriceMap.get(item.item_id) ?? 0;

    // Apply promo discount to tier price (base price already has it applied)
    if (tierPriceMap.has(`${item.item_id}:${item.unit}`)) {
      const discount = promoDiscountMap.get(item.item_id) ?? 0;
      if (discount > 0) {
        unitPrice = Math.round(unitPrice * (1 - discount / 100) * 100) / 100;
      }
    }

    subtotal += unitPrice * item.quantity;
    return { ...item, unitPrice };
  });

  const total = subtotal + deliveryFee;

  // Check minimum order amount
  if (subtotal < settings.min_order_amount) {
    return NextResponse.json(
      {
        error: `Minimum order amount is ${settings.currency_symbol}${settings.min_order_amount}`,
        code: "MIN_ORDER_NOT_MET",
      },
      { status: 400 },
    );
  }

  // ── Generate delivery code ─────────────────────────────
  const deliveryCode = generateDeliveryCode();

  // Sanitize user input
  const sanitizedAddress = sanitizeText(address);
  const sanitizedNotes = notes ? sanitizeText(notes) : null;

  // ── Insert order ───────────────────────────────────────
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      address: sanitizedAddress,
      status: "pending",
      grade: token.grade,
      token_id: token.id,
      notes: sanitizedNotes,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      delivery_code: deliveryCode,
      ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error("Error creating order:", orderError);
    return NextResponse.json(
      { error: "Failed to create order", code: "ORDER_CREATE_ERROR" },
      { status: 500 },
    );
  }

  // ── Decrement stock (convert to base unit) ──────────
  const stockItems = itemsWithPrices.map((item) => {
    const baseUnit = unitMap.get(item.item_id) ?? "g";
    return {
      item_id: item.item_id,
      quantity: convertUnits(item.quantity, item.unit, baseUnit),
    };
  });

  const { data: stockResults, error: stockError } = await supabase.rpc("decrement_stock", {
    p_items: stockItems,
  });

  if (stockError) {
    console.error("Stock decrement failed:", stockError);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: "Failed to reserve stock. Please try again.", code: "STOCK_ERROR" },
      { status: 409 },
    );
  }

  // Check if any items failed stock check
  const failedItems = (
    stockResults as { item_id: string; success: boolean; error: string }[]
  )?.filter((r) => !r.success);

  if (failedItems && failedItems.length > 0) {
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      {
        error: "Some items are out of stock",
        details: failedItems.map((f) => ({
          item_id: f.item_id,
          reason: f.error,
        })),
        code: "INSUFFICIENT_STOCK",
      },
      { status: 409 },
    );
  }

  // ── Insert order items with unit_price ───────────────
  const orderItems = itemsWithPrices.map((item) => {
    const baseUnit = unitMap.get(item.item_id) ?? "g";
    return {
      order_id: order.id as string,
      item_id: item.item_id,
      name: sanitizeText(item.name),
      variety: sanitizeText(item.variety),
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unitPrice,
      stock_decrement: convertUnits(item.quantity, item.unit, baseUnit),
      category_slug: null as string | null,
      custom_fields: {} as Record<string, unknown>,
    };
  });

  const { error: orderItemsError } = await supabase.from("order_items").insert(orderItems);

  if (orderItemsError) {
    console.error("Error creating order items:", orderItemsError);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json(
      { error: "Failed to add items to order", code: "ORDER_ITEMS_ERROR" },
      { status: 500 },
    );
  }

  // Mark token as used
  const { error: tokenUpdateError } = await supabase
    .from("secure_tokens")
    .update({ used: true })
    .eq("id", token.id);

  if (tokenUpdateError) {
    console.error("Error updating token:", tokenUpdateError);
  }

  return NextResponse.json(
    {
      message: "Order submitted successfully",
      order_id: order.id,
      delivery_code: deliveryCode,
      subtotal,
      delivery_fee: deliveryFee,
      total,
    },
    { status: 201 },
  );
}
