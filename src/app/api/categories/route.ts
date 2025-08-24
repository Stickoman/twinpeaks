import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createCategorySchema } from "@/lib/validations/categories";
import { requireAuth } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import type { Category } from "@/types/database";

// ────────────────────────────────────────────────────────────
// GET /api/categories — list all active categories
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("categories")
      .select(
        "id, name, slug, icon, sort_order, unit_type, grade_visibility, custom_fields_schema, low_stock_threshold, is_active, created_at, updated_at",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch categories." }, { status: 500 });
    }

    return NextResponse.json(data as Category[]);
  } catch (err) {
    console.error("[Categories GET] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// ────────────────────────────────────────────────────────────
// POST /api/categories — create a new category (admin only)
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: parsed.data.name,
        slug: parsed.data.slug,
        icon: parsed.data.icon,
        sort_order: parsed.data.sort_order,
        grade_visibility: parsed.data.grade_visibility,
        unit_type: parsed.data.unit_type,
        custom_fields_schema: parsed.data.custom_fields_schema,
        low_stock_threshold: parsed.data.low_stock_threshold,
        is_active: parsed.data.is_active,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A category with this slug already exists." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
    }

    logAudit({
      action: "category_created",
      entityType: "category",
      entityId: (data as Category).id,
      actorId: auth.session.userId,
      details: { name: parsed.data.name, slug: parsed.data.slug },
    });

    return NextResponse.json(data as Category, { status: 201 });
  } catch (err) {
    console.error("[Categories POST] error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
