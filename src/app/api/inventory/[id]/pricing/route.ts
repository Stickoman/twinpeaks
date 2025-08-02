import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { generateDefaultTiers } from "@/lib/utils/pricing";
import { logAudit } from "@/lib/audit";

const tierSchema = z.object({
  unit: z.string().min(1).max(50),
  price: z.number().min(0),
  min_quantity: z.number().int().min(1).default(1),
  max_quantity: z.number().int().min(1).nullable().default(null),
  sort_order: z.number().int().min(0).default(0),
});

const updateTiersSchema = z.object({
  tiers: z.array(tierSchema).max(20),
});

const generateTiersSchema = z.object({
  base_price: z.number().min(0),
  base_unit: z.string().min(1).max(50),
  markup_coefficient: z.number().min(1).max(2).default(1.1),
});

// GET /api/inventory/[id]/pricing
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("pricing_tiers")
    .select("id, item_id, unit, price, min_quantity, max_quantity, sort_order, created_at")
    .eq("item_id", id)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Pricing tiers fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch pricing tiers" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/inventory/[id]/pricing - set/override all tiers
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateTiersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // Delete existing tiers for this item
  const { error: deleteError } = await supabase.from("pricing_tiers").delete().eq("item_id", id);

  if (deleteError) {
    console.error("Delete tiers error:", deleteError);
    return NextResponse.json({ error: "Failed to update pricing tiers" }, { status: 500 });
  }

  // Insert new tiers
  if (parsed.data.tiers.length > 0) {
    const rows = parsed.data.tiers.map((tier) => ({
      item_id: id,
      ...tier,
    }));

    const { error: insertError } = await supabase.from("pricing_tiers").insert(rows);

    if (insertError) {
      console.error("Insert tiers error:", insertError);
      return NextResponse.json({ error: "Failed to save pricing tiers" }, { status: 500 });
    }
  }

  logAudit({
    action: "pricing_tiers_updated",
    entityType: "item",
    entityId: id,
    actorId: auth.session.userId,
    details: { tier_count: parsed.data.tiers.length },
  });

  return NextResponse.json({ message: "Pricing tiers updated", count: parsed.data.tiers.length });
}

// POST /api/inventory/[id]/pricing - auto-generate from base price
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = generateTiersSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const tiers = generateDefaultTiers(
    parsed.data.base_price,
    parsed.data.base_unit,
    parsed.data.markup_coefficient,
  );

  const supabase = createServiceClient();

  // Delete existing tiers
  await supabase.from("pricing_tiers").delete().eq("item_id", id);

  // Insert generated tiers
  if (tiers.length > 0) {
    const rows = tiers.map((tier) => ({
      item_id: id,
      ...tier,
    }));

    const { error: insertError } = await supabase.from("pricing_tiers").insert(rows);

    if (insertError) {
      console.error("Insert generated tiers error:", insertError);
      return NextResponse.json({ error: "Failed to save generated tiers" }, { status: 500 });
    }
  }

  logAudit({
    action: "pricing_tiers_generated",
    entityType: "item",
    entityId: id,
    actorId: auth.session.userId,
    details: {
      base_price: parsed.data.base_price,
      base_unit: parsed.data.base_unit,
      tier_count: tiers.length,
    },
  });

  return NextResponse.json({ tiers, count: tiers.length }, { status: 201 });
}
