import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import type { OrderStatus } from "@/types/database";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface OrdersByDay {
  date: string;
  count: number;
}

interface OrdersByStatus {
  status: OrderStatus;
  count: number;
}

interface TopProduct {
  name: string;
  variety: string;
  total_ordered: number;
}

interface StatsResponse {
  total_orders: number;
  pending_orders: number;
  delivered_orders: number;
  products_in_stock: number;
  orders_by_day: OrdersByDay[];
  orders_by_status: OrdersByStatus[];
  top_products: TopProduct[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

// ────────────────────────────────────────────────────────────
// GET /api/stats
// ────────────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();

    const [ordersRes, itemsRes, orderItemsRes] = await Promise.all([
      supabase.from("orders").select("id, status, created_at"),
      supabase.from("items").select("id, quantity"),
      supabase.from("order_items").select("name, variety, quantity"),
    ]);

    if (ordersRes.error) {
      return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
    }
    if (itemsRes.error) {
      return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
    }
    if (orderItemsRes.error) {
      return NextResponse.json({ error: "Failed to fetch order items" }, { status: 500 });
    }

    const allOrders = ordersRes.data ?? [];
    const allItems = itemsRes.data ?? [];
    const allOrderItems = orderItemsRes.data ?? [];

    const total_orders = allOrders.length;

    const statusCounts: Record<string, number> = {};
    for (const order of allOrders) {
      statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1;
    }

    const statuses: OrderStatus[] = ["pending", "assigned", "en_route", "delivered", "cancelled"];
    const orders_by_status: OrdersByStatus[] = statuses.map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
    }));

    const pending_orders = statusCounts["pending"] ?? 0;
    const delivered_orders = statusCounts["delivered"] ?? 0;

    const products_in_stock = allItems.filter((item) => item.quantity > 0).length;

    const last7Days = getLast7Days();
    const dayCountMap: Record<string, number> = {};

    for (const day of last7Days) {
      dayCountMap[day] = 0;
    }

    for (const order of allOrders) {
      const day = order.created_at.split("T")[0];
      if (day in dayCountMap) {
        dayCountMap[day] += 1;
      }
    }

    const orders_by_day: OrdersByDay[] = last7Days.map((date) => ({
      date,
      count: dayCountMap[date],
    }));

    const productMap = new Map<string, TopProduct>();
    for (const item of allOrderItems) {
      const key = `${item.name}__${item.variety}`;
      const existing = productMap.get(key);
      if (existing) {
        existing.total_ordered += item.quantity;
      } else {
        productMap.set(key, {
          name: item.name,
          variety: item.variety,
          total_ordered: item.quantity,
        });
      }
    }

    const top_products = Array.from(productMap.values())
      .sort((a, b) => b.total_ordered - a.total_ordered)
      .slice(0, 5);

    const response: StatsResponse = {
      total_orders,
      pending_orders,
      delivered_orders,
      products_in_stock,
      orders_by_day,
      orders_by_status,
      top_products,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[Stats GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
