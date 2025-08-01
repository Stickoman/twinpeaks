import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createItemSchema } from "@/lib/validations/inventory";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import type { Item } from "@/types/database";

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("items")
      .select(
        "id, name, type, variety, quantity, unit_measure, price, image_url, category_id, custom_fields, low_stock_threshold, badges, is_featured, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch inventory." }, { status: 500 });
    }

    return NextResponse.json(data as Item[]);
  } catch (err) {
    console.error("[Inventory GET] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("items")
      .insert({
        name: parsed.data.name,
        type: parsed.data.type ?? null,
        variety: parsed.data.variety,
        quantity: parsed.data.quantity,
        price: parsed.data.price ?? 0,
        unit_measure: parsed.data.unit_measure ?? "g",
        image_url: parsed.data.image_url ?? null,
        category_id: parsed.data.category_id ?? null,
        custom_fields: parsed.data.custom_fields ?? {},
        low_stock_threshold: parsed.data.low_stock_threshold ?? null,
        badges: parsed.data.badges ?? [],
        is_featured: parsed.data.is_featured ?? false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create item." }, { status: 500 });
    }

    logAudit({
      action: "item_created",
      entityType: "item",
      entityId: (data as Item).id,
      actorId: auth.session.userId,
      details: { name: parsed.data.name },
    });

    return NextResponse.json(data as Item, { status: 201 });
  } catch (err) {
    console.error("[Inventory POST] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
