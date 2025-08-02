import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

const restockSchema = z.object({
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(100_000, "Quantity cannot exceed 100,000"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const body: unknown = await request.json();
  const parsed = restockSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();

  const { error } = await supabase.rpc("increment_stock", {
    p_item_id: id,
    p_quantity: parsed.data.quantity,
  });

  if (error) {
    console.error("Restock error:", error);
    return NextResponse.json({ error: "Failed to restock item" }, { status: 500 });
  }

  logAudit({
    action: "item_restocked",
    entityType: "item",
    entityId: id,
    actorId: auth.session.userId,
    details: { quantity_added: parsed.data.quantity },
  });

  return NextResponse.json({ message: "Item restocked successfully" });
}
