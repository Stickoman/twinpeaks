import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { deleteProductImage } from "@/lib/supabase/storage";
import { createItemSchema, updateItemSchema } from "@/lib/validations/inventory";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const bulkCreateSchema = z.array(createItemSchema).min(1).max(100);
const bulkUpdateSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      data: updateItemSchema,
    }),
  )
  .min(1)
  .max(100);
const bulkDeleteSchema = z.array(z.string().uuid()).min(1).max(100);

export async function POST(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (!auth.authenticated) return auth.response;

    const body: unknown = await request.json();
    const parsed = bulkCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const items = parsed.data.map((item) => ({
      name: item.name,
      type: item.type ?? null,
      variety: item.variety,
      quantity: item.quantity,
      unit_measure: item.unit_measure ?? "g",
      image_url: item.image_url ?? null,
    }));

    const { data, error } = await supabase.from("items").insert(items).select();
    if (error) {
      console.error("Bulk create error:", error);
      return NextResponse.json({ error: "Failed to create items" }, { status: 500 });
    }

    logAudit({
      action: "bulk_items_created",
      entityType: "item",
      actorId: auth.session.userId,
      details: { count: data.length },
    });

    return NextResponse.json({ created: data, count: data.length }, { status: 201 });
  } catch (err) {
    console.error("Bulk create POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (!auth.authenticated) return auth.response;

    const body: unknown = await request.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();
    const results = await Promise.allSettled(
      parsed.data.map(async ({ id, data }) => {
        const { data: updated, error } = await supabase
          .from("items")
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw new Error(`Failed to update ${id}: ${error.message}`);
        return updated;
      }),
    );

    const succeeded = results
      .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === "fulfilled")
      .map((r) => r.value);
    const failed = results
      .map((r, i) => ({ index: i, id: parsed.data[i].id, result: r }))
      .filter((r) => r.result.status === "rejected")
      .map((r) => ({
        id: r.id,
        error: (r.result as PromiseRejectedResult).reason?.message ?? "Unknown error",
      }));

    logAudit({
      action: "bulk_items_updated",
      entityType: "item",
      actorId: auth.session.userId,
      details: { succeeded: succeeded.length, failed: failed.length },
    });

    return NextResponse.json({ succeeded, failed });
  } catch (err) {
    console.error("Bulk update PUT error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth("admin");
    if (!auth.authenticated) return auth.response;

    const body: unknown = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const ids = parsed.data;
    const supabase = createServiceClient();

    // Fetch items to get image URLs for cleanup
    const { data: items } = await supabase.from("items").select("id, image_url").in("id", ids);

    // Delete images from storage
    if (items) {
      await Promise.allSettled(
        items.filter((i) => i.image_url).map((i) => deleteProductImage(i.image_url!)),
      );
    }

    const { error } = await supabase.from("items").delete().in("id", ids);
    if (error) {
      console.error("Bulk delete error:", error);
      return NextResponse.json({ error: "Failed to delete items" }, { status: 500 });
    }

    logAudit({
      action: "bulk_items_deleted",
      entityType: "item",
      actorId: auth.session.userId,
      details: { count: ids.length },
    });

    return NextResponse.json({ deleted: ids.length });
  } catch (err) {
    console.error("Bulk delete DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
