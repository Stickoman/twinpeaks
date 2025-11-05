import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/driver/shift - Get current active shift
// POST /api/driver/shift - Start a new shift
// ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const { data: shift } = await supabase
      .from("driver_shifts")
      .select("*")
      .eq("driver_id", auth.session.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ shift: shift ?? null });
  } catch (err) {
    console.error("[Driver shift GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(): Promise<NextResponse> {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    // Check if there's already an active shift
    const { data: existing } = await supabase
      .from("driver_shifts")
      .select("id")
      .eq("driver_id", auth.session.userId)
      .is("ended_at", null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "A shift is already active" }, { status: 400 });
    }

    const { data: shift, error } = await supabase
      .from("driver_shifts")
      .insert({
        driver_id: auth.session.userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error starting shift:", error);
      return NextResponse.json({ error: "Failed to start shift" }, { status: 500 });
    }

    return NextResponse.json({ shift });
  } catch (err) {
    console.error("[Driver shift POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
