import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth, requireMfa } from "@/lib/api-auth";
import { purgeSchema, getCutoffDate } from "@/lib/validations/purge";
import { logAudit } from "@/lib/audit";

// ────────────────────────────────────────────────────────────
// POST /api/admin/purge — Execute hard DELETE
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
    const deleted: Record<string, number> = {};

    // Helper to delete rows with error handling
    async function deleteFromTable(table: string, dateColumn: string, driverColumn?: string) {
      let query = supabase.from(table).delete({ count: "exact" });

      if (cutoffStr) {
        query = query.lt(dateColumn, cutoffStr);
      }
      if (scope === "driver" && driver_id && driverColumn) {
        query = query.eq(driverColumn, driver_id);
      }
      if (!cutoffStr && scope === "site") {
        query = query.gte(dateColumn, "1970-01-01T00:00:00.000Z");
      }
      if (!cutoffStr && scope === "driver" && driver_id && driverColumn) {
        // "all" time range for driver: filter only by driver, need at least one clause
        // The eq above already handles this
      }

      const { count, error } = await query;
      if (error) {
        console.error(`[Purge] delete error on ${table}:`, error.message);
      }
      deleted[table] = count ?? 0;
    }

    // Delete in dependency order (children first)
    if (scope === "driver" && driver_id) {
      // Driver-specific deletion
      await deleteFromTable("chat_messages", "created_at", "sender_id");
      await deleteFromTable("driver_locations", "recorded_at", "driver_id");
      await deleteFromTable("delivery_proofs", "created_at", "driver_id");
      await deleteFromTable("delivery_routes", "created_at", "driver_id");
      await deleteFromTable("driver_shifts", "created_at", "driver_id");

      // Orders need special handling — get order IDs first, then cascade
      let ordersQuery = supabase.from("orders").select("id").eq("assigned_driver_id", driver_id);

      if (cutoffStr) {
        ordersQuery = ordersQuery.lt("created_at", cutoffStr);
      }

      const { data: orderRows } = await ordersQuery;
      const orderIds = (orderRows ?? []).map((o) => o.id);

      if (orderIds.length > 0) {
        // Delete order children
        const { count: itemCount } = await supabase
          .from("order_items")
          .delete({ count: "exact" })
          .in("order_id", orderIds);
        deleted.order_items = itemCount ?? 0;

        const { count: subCount } = await supabase
          .from("push_subscriptions")
          .delete({ count: "exact" })
          .in("order_id", orderIds);
        deleted.push_subscriptions = subCount ?? 0;

        // Delete orders
        const { count: orderCount } = await supabase
          .from("orders")
          .delete({ count: "exact" })
          .in("id", orderIds);
        deleted.orders = orderCount ?? 0;
      }
    } else {
      // Site-wide deletion — order matters for foreign keys
      await deleteFromTable("chat_messages", "created_at");
      await deleteFromTable("push_subscriptions", "created_at");
      await deleteFromTable("driver_locations", "recorded_at");
      await deleteFromTable("delivery_proofs", "created_at");
      await deleteFromTable("delivery_routes", "created_at");
      await deleteFromTable("driver_shifts", "created_at");
      // Delete order_items via matching orders (order_items has no created_at)
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
          .delete({ count: "exact" })
          .in("order_id", orderIds);
        deleted.order_items = itemCount ?? 0;
      }

      // Delete orders last
      await deleteFromTable("orders", "created_at");
    }

    const totalDeleted = Object.values(deleted).reduce((a, b) => a + b, 0);

    logAudit({
      action: "data_purge",
      entityType: "system",
      entityId: scope === "driver" ? (driver_id ?? null) : null,
      actorId: auth.session.userId,
      details: { scope, time_range, deleted, totalDeleted },
    });

    return NextResponse.json({ deleted, totalDeleted });
  } catch (err) {
    console.error("[Purge execute] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
