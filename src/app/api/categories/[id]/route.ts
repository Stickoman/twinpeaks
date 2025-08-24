import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { updateCategorySchema } from "@/lib/validations/categories";
import type { Category } from "@/types/database";

// ────────────────────────────────────────────────────────────
// GET /api/categories/[id]
// ────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("categories")
    .select(
      "id, name, slug, icon, sort_order, unit_type, grade_visibility, custom_fields_schema, low_stock_threshold, is_active, created_at, updated_at",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to fetch category" }, { status: 500 });
  }

  return NextResponse.json(data as Category);
}

// ────────────────────────────────────────────────────────────
// PUT /api/categories/[id]
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = updateCategorySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("categories")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A category with this slug already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }

  logAudit({
    action: "category_updated",
    entityType: "category",
    entityId: id,
    actorId: auth.session.userId,
  });

  return NextResponse.json(data as Category);
}

// ────────────────────────────────────────────────────────────
// DELETE /api/categories/[id]
// ────────────────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  // Soft-delete: deactivate instead of hard delete to preserve referential integrity
  const { data, error } = await supabase
    .from("categories")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }

  logAudit({
    action: "category_deleted",
    entityType: "category",
    entityId: id,
    actorId: auth.session.userId,
    details: { name: (data as { id: string; name: string }).name },
  });

  return NextResponse.json({ message: "Category deactivated successfully" }, { status: 200 });
}
