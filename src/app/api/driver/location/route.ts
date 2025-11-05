import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireDriver } from "@/lib/api-auth";
import { updateLocationSchema } from "@/lib/validations/driver";
import { checkRateLimit } from "@/lib/rate-limit";

// ────────────────────────────────────────────────────────────
// POST /api/driver/location - Update driver GPS position
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireDriver();
  if (!auth.authenticated) return auth.response;

  const { allowed } = await checkRateLimit(`driver:location:${auth.session.userId}`, 60, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many location updates." }, { status: 429 });
  }

  try {
    const body: unknown = await request.json();
    const parsed = updateLocationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid location data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    const { error } = await supabase.from("driver_locations").insert({
      driver_id: auth.session.userId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      accuracy: parsed.data.accuracy ?? null,
      heading: parsed.data.heading ?? null,
      speed: parsed.data.speed ?? null,
    });

    if (error) {
      console.error("Error updating driver location:", error);
      return NextResponse.json({ error: "Failed to update location" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Driver location POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
