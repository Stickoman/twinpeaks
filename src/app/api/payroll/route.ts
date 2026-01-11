import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { createPayrollSchema } from "@/lib/validations/payroll";
import { logAudit } from "@/lib/audit";

const payrollQuerySchema = z.object({
  driver_id: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "paid"]).optional(),
});

// ────────────────────────────────────────────────────────────
// GET /api/payroll - List all payroll records
// POST /api/payroll - Create a new payroll entry
// ────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const { searchParams } = new URL(request.url);
    const queryParsed = payrollQuerySchema.safeParse({
      driver_id: searchParams.get("driver_id") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryParsed.error.flatten() },
        { status: 400 },
      );
    }

    const { driver_id: driverId, status } = queryParsed.data;

    let query = supabase
      .from("driver_payroll")
      .select("*")
      .order("period_end", { ascending: false });

    if (driverId) query = query.eq("driver_id", driverId);
    if (status) query = query.eq("status", status);

    const { data, error } = await query.limit(100);

    if (error) {
      console.error("Error fetching payroll:", error);
      return NextResponse.json({ error: "Failed to fetch payroll" }, { status: 500 });
    }

    // Enrich with driver names
    const driverIds = [...new Set((data ?? []).map((p) => p.driver_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", driverIds.length > 0 ? driverIds : ["00000000-0000-0000-0000-000000000000"]);

    const nameMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    const enriched = (data ?? []).map((p) => ({
      ...p,
      driver_name: nameMap.get(p.driver_id) ?? "Unknown",
    }));

    return NextResponse.json({ payroll: enriched });
  } catch (err) {
    console.error("[Payroll GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("super_admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createPayrollSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Verify driver exists
    const { data: driver } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", parsed.data.driver_id)
      .eq("role", "driver")
      .single();

    if (!driver) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("driver_payroll")
      .insert({
        driver_id: parsed.data.driver_id,
        period_start: parsed.data.period_start,
        period_end: parsed.data.period_end,
        base_pay: parsed.data.base_pay,
        delivery_bonus: parsed.data.delivery_bonus,
        total_pay: parsed.data.total_pay,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating payroll:", error);
      return NextResponse.json({ error: "Failed to create payroll entry" }, { status: 500 });
    }

    logAudit({
      action: "payroll_created",
      entityType: "driver_payroll",
      entityId: data.id,
      actorId: auth.session.userId,
      details: { driver_id: parsed.data.driver_id, total_pay: parsed.data.total_pay },
    });

    return NextResponse.json({ payroll: data }, { status: 201 });
  } catch (err) {
    console.error("[Payroll POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
