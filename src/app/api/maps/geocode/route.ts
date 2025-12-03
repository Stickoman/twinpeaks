import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { batchGeocode, geocodeAddress } from "@/lib/utils/geocoding";
import { z } from "zod/v4";

const singleSchema = z.object({ address: z.string().min(1) });
const batchSchema = z.object({ addresses: z.array(z.string().min(1)).min(1).max(25) });

// ────────────────────────────────────────────────────────────
// POST /api/maps/geocode — single or batch geocoding
// ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();

    // Batch geocoding
    const batchParsed = batchSchema.safeParse(body);
    if (batchParsed.success) {
      const results = await batchGeocode(batchParsed.data.addresses);
      return NextResponse.json({ results });
    }

    // Single geocoding
    const singleParsed = singleSchema.safeParse(body);
    if (singleParsed.success) {
      const result = await geocodeAddress(singleParsed.data.address);
      if (!result) {
        return NextResponse.json({ error: "Address not found" }, { status: 404 });
      }
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "Invalid request. Provide 'address' (string) or 'addresses' (string[])." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[Maps geocode POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
