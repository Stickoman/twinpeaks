import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getGoogleDirections } from "@/lib/utils/directions";
import { z } from "zod/v4";

const latLngSchema = z.object({ lat: z.number(), lng: z.number() });

const directionsSchema = z.object({
  origin: latLngSchema,
  destination: latLngSchema,
  waypoints: z.array(latLngSchema).max(25).optional(),
});

// ────────────────────────────────────────────────────────────
// POST /api/maps/directions — get driving directions + polyline
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = directionsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { origin, destination, waypoints } = parsed.data;
    const result = await getGoogleDirections(origin, destination, waypoints);

    if (!result) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Maps directions POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
