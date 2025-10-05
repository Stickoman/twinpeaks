import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/drivers/locations - Get all active driver positions
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    // Get active drivers
    const { data: drivers, error: driversError } = await supabase
      .from("profiles")
      .select("id, username, phone, vehicle_info")
      .eq("role", "driver")
      .eq("is_active", true);

    if (driversError) {
      console.error("Error fetching active drivers:", driversError);
      return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
    }

    if (!drivers || drivers.length === 0) {
      return NextResponse.json([]);
    }

    const driverIds = drivers.map((d) => d.id);

    // Get the latest location for each active driver
    // Using a subquery approach: get all recent locations, then pick the latest per driver
    const { data: locations, error: locError } = await supabase
      .from("driver_locations")
      .select("driver_id, latitude, longitude, accuracy, heading, speed, recorded_at")
      .in("driver_id", driverIds)
      .order("recorded_at", { ascending: false });

    if (locError) {
      console.error("Error fetching driver locations:", locError);
      return NextResponse.json({ error: "Failed to fetch locations" }, { status: 500 });
    }

    // Pick latest location per driver
    const latestByDriver = new Map<
      string,
      {
        driver_id: string;
        latitude: number;
        longitude: number;
        accuracy: number | null;
        heading: number | null;
        speed: number | null;
        recorded_at: string;
      }
    >();

    for (const loc of locations ?? []) {
      if (!latestByDriver.has(loc.driver_id)) {
        latestByDriver.set(loc.driver_id, loc);
      }
    }

    // Merge driver info with location
    const result = drivers.map((driver) => {
      const loc = latestByDriver.get(driver.id);
      return {
        ...driver,
        location: loc
          ? {
              latitude: loc.latitude,
              longitude: loc.longitude,
              accuracy: loc.accuracy,
              heading: loc.heading,
              speed: loc.speed,
              recorded_at: loc.recorded_at,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Drivers locations GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
