import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteProductImage } from "@/lib/supabase/storage";
import { logAudit } from "@/lib/audit";
import { updateItemSchema } from "@/lib/validations/inventory";

// ────────────────────────────────────────────────────────────
// GET /api/inventory/[id]
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("items")
    .select(
      "id, name, type, variety, quantity, unit_measure, price, image_url, category_id, custom_fields, low_stock_threshold, badges, is_featured, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch product" }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ────────────────────────────────────────────────────────────
// PUT /api/inventory/[id]
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  // If image_url is changing, delete the old image
  if (parsed.data.image_url !== undefined) {
    const { data: existing } = await supabase
      .from("items")
      .select("image_url")
      .eq("id", id)
      .single();

    if (existing?.image_url && existing.image_url !== parsed.data.image_url) {
      await deleteProductImage(existing.image_url);
    }
  }

  const { data, error } = await supabase
    .from("items")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }

  logAudit({
    action: "item_updated",
    entityType: "item",
    entityId: id,
    actorId: auth.session.userId,
  });

  return NextResponse.json(data);
}

// ────────────────────────────────────────────────────────────
// DELETE /api/inventory/[id]
// ────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  // Fetch item to get image_url before deletion
  const { data: existing } = await supabase.from("items").select("image_url").eq("id", id).single();

  if (existing?.image_url) {
    await deleteProductImage(existing.image_url);
  }

  const { error } = await supabase.from("items").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }

  logAudit({
    action: "item_deleted",
    entityType: "item",
    entityId: id,
    actorId: auth.session.userId,
  });

  return NextResponse.json({ message: "Product deleted successfully" }, { status: 200 });
}
