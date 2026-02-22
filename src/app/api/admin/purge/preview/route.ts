import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth, requireMfa } from "@/lib/api-auth";
import { purgeSchema, getCutoffDate } from "@/lib/validations/purge";

// ────────────────────────────────────────────────────────────
// POST /api/admin/purge/preview — Count records that would be deleted
// god_admin only. MFA verification required server-side.
// ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("god_admin");
  if (!auth.authenticated) return auth.response;

  const mfa = await requireMfa();
  if (!mfa.verified) return mfa.response;

  try {
    const body: unknown = await request.json();
    const parsed = purgeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { scope, driver_id, time_range } = parsed.data;

    if (scope === "driver" && !driver_id) {
      return NextResponse.json({ error: "driver_id required for driver scope" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const cutoff = getCutoffDate(time_range);
    const cutoffStr = cutoff?.toISOString() ?? null;

    const counts: Record<string, number> = {};

    // Helper to count rows
    async function countTable(table: string, dateColumn: string, driverColumn?: string) {
      let query = supabase.from(table).select("id", { count: "exact", head: true });

      if (cutoffStr) {
        query = query.lt(dateColumn, cutoffStr);
      }
      if (scope === "driver" && driver_id && driverColumn) {
        query = query.eq(driverColumn, driver_id);
      }
      if (!cutoffStr && scope === "site") {
        query = query.gte(dateColumn, "1970-01-01T00:00:00.000Z");
      }

      const { count, error } = await query;
      if (error) {
        console.error(`[Purge preview] count error on ${table}:`, error.message);
      }
      counts[table] = count ?? 0;
    }

    if (scope === "driver" && driver_id) {
      await countTable("orders", "created_at", "assigned_driver_id");
      await countTable("delivery_proofs", "created_at", "driver_id");
      await countTable("delivery_routes", "created_at", "driver_id");
      await countTable("driver_locations", "recorded_at", "driver_id");
      await countTable("driver_shifts", "created_at", "driver_id");
      await countTable("chat_messages", "created_at", "sender_id");

      // Count order_items for this driver's orders
      let ordersQuery = supabase.from("orders").select("id").eq("assigned_driver_id", driver_id);
      if (cutoffStr) ordersQuery = ordersQuery.lt("created_at", cutoffStr);
      const { data: orderRows } = await ordersQuery;
      const orderIds = (orderRows ?? []).map((o) => o.id);

      if (orderIds.length > 0) {
        const { count: itemCount } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .in("order_id", orderIds);
        counts.order_items = itemCount ?? 0;

        const { count: subCount } = await supabase
          .from("push_subscriptions")
          .select("id", { count: "exact", head: true })
          .in("order_id", orderIds);
        counts.push_subscriptions = subCount ?? 0;
      }
    } else {
      // Site-wide: count orders first to derive order_items count
      await countTable("orders", "created_at");
      await countTable("delivery_proofs", "created_at");
      await countTable("delivery_routes", "created_at");
      await countTable("driver_locations", "recorded_at");
      await countTable("driver_shifts", "created_at");
      await countTable("push_subscriptions", "created_at");
      await countTable("chat_messages", "created_at");
      // Count order_items via matching orders (order_items has no created_at)
      let ordersQuery = supabase.from("orders").select("id");
      if (cutoffStr) {
        ordersQuery = ordersQuery.lt("created_at", cutoffStr);
      } else {
        ordersQuery = ordersQuery.gte("created_at", "1970-01-01T00:00:00.000Z");
      }
      const { data: orderRows } = await ordersQuery;
      const orderIds = (orderRows ?? []).map((o) => o.id);

      if (orderIds.length > 0) {
        const { count: itemCount } = await supabase
          .from("order_items")
          .select("id", { count: "exact", head: true })
          .in("order_id", orderIds);
        counts.order_items = itemCount ?? 0;
      }
    }

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    return NextResponse.json({ counts, totalRecords });
  } catch (err) {
    console.error("[Purge preview] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
