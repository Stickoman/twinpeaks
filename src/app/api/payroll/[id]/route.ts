import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { updatePayrollSchema } from "@/lib/validations/payroll";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────
// PUT /api/payroll/[id] - Update payroll entry (status, amounts)
// DELETE /api/payroll/[id] - Delete payroll entry
// ────────────────────────────────────────────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("super_admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const body: unknown = await request.json();
    const parsed = updatePayrollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("driver_payroll")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Payroll entry not found" }, { status: 404 });
      }
      console.error("Error updating payroll:", error);
      return NextResponse.json({ error: "Failed to update payroll" }, { status: 500 });
    }

    logAudit({
      action: "payroll_updated",
      entityType: "driver_payroll",
      entityId: id,
      actorId: auth.session.userId,
      details: parsed.data,
    });

    return NextResponse.json({ payroll: data });
  } catch (err) {
    console.error("[Payroll PUT] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth("god_admin");
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from("driver_payroll").delete().eq("id", id);

    if (error) {
      console.error("Error deleting payroll:", error);
      return NextResponse.json({ error: "Failed to delete payroll entry" }, { status: 500 });
    }

    logAudit({
      action: "payroll_deleted",
      entityType: "driver_payroll",
      entityId: id,
      actorId: auth.session.userId,
    });

    return NextResponse.json({ message: "Payroll entry deleted" });
  } catch (err) {
    console.error("[Payroll DELETE] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
