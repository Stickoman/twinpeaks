import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// GET /api/drivers/routes — manager view: active driver routes with assigned orders
export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  const supabase = createServiceClient();

  // Get all active drivers with their latest locations
  const { data: drivers, error: driversError } = await supabase
    .from("profiles")
    .select("id, username, phone, vehicle_info")
    .eq("role", "driver")
    .eq("is_active", true);

  if (driversError) {
    console.error("Error fetching drivers:", driversError);
    return NextResponse.json({ error: "Failed to fetch drivers" }, { status: 500 });
  }

  const driverIds = (drivers ?? []).map((d) => d.id as string);

  if (driverIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get latest locations for each driver
  const { data: locations } = await supabase
    .from("driver_locations")
    .select("driver_id, latitude, longitude, recorded_at")
    .in("driver_id", driverIds)
    .order("recorded_at", { ascending: false });

  // Deduplicate: latest per driver
  const latestLocations = new Map<
    string,
    { latitude: number; longitude: number; recorded_at: string }
  >();
  for (const loc of locations ?? []) {
    if (!latestLocations.has(loc.driver_id as string)) {
      latestLocations.set(loc.driver_id as string, {
        latitude: loc.latitude as number,
        longitude: loc.longitude as number,
        recorded_at: loc.recorded_at as string,
      });
    }
  }

  // Get assigned orders for each driver
  const { data: orders } = await supabase
    .from("orders")
    .select("id, address, status, latitude, longitude, assigned_driver_id, assigned_at")
    .in("assigned_driver_id", driverIds)
    .in("status", ["assigned", "en_route"]);

  // Group orders by driver
  const ordersByDriver = new Map<string, typeof orders>();
  for (const order of orders ?? []) {
    const driverId = order.assigned_driver_id as string;
    if (!ordersByDriver.has(driverId)) {
      ordersByDriver.set(driverId, []);
    }
    ordersByDriver.get(driverId)!.push(order);
  }

  // Build response
  const result = (drivers ?? []).map((driver) => ({
    driver: {
      id: driver.id,
      username: driver.username,
      phone: driver.phone,
      vehicle_info: driver.vehicle_info,
    },
    location: latestLocations.get(driver.id as string) ?? null,
    orders: ordersByDriver.get(driver.id as string) ?? [],
  }));

  return NextResponse.json(result);
}
