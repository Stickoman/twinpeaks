import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

// DELETE /api/promo-codes/[id] — soft delete (deactivate)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;
  const supabase = createServiceClient();

  const { error } = await supabase.from("promo_codes").update({ is_active: false }).eq("id", id);

  if (error) {
    console.error("Promo code delete error:", error);
    return NextResponse.json({ error: "Failed to deactivate promo code" }, { status: 500 });
  }

  logAudit({
    action: "promo_code_deactivated",
    entityType: "promo_code",
    entityId: id,
    actorId: auth.session.userId,
  });

  return NextResponse.json({ message: "Promo code deactivated" });
}
