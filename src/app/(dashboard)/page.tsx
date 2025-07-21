"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion } from "framer-motion";
import { Package, Link as LinkIcon, ShoppingCart, Truck, Plus, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Item, Order, OrderStatus, SecureToken } from "@/types/database";
import { formatRelativeTime } from "@/lib/utils/helpers";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import { staggerContainer, fadeUpItem } from "@/lib/motion";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load: " + res.statusText);
  return res.json() as Promise<T>;
}

function AnimatedCounter({ value }: { value: number }) {
  return (
    <motion.div
      className="text-2xl font-bold text-foreground"
      key={value}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {value}
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: items, isLoading: loadingItems } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: () => fetchJson<Item[]>("/api/inventory"),
  });
  const { data: orders, isLoading: loadingOrders } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: () => fetchJson<Order[]>("/api/orders"),
  });
  const { data: tokens, isLoading: loadingTokens } = useQuery<SecureToken[]>({
    queryKey: ["tokens"],
    queryFn: () => fetchJson<SecureToken[]>("/api/tokens"),
  });

  const totalItems = items?.length ?? 0;
  const [now] = useState(() => Date.now());
  const activeTokens =
    tokens?.filter((t) => !t.used && !t.locked && new Date(t.expires_at).getTime() > now).length ??
    0;
  const pendingOrders = orders?.filter((o) => o.status === "pending").length ?? 0;
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const deliveredToday =
    orders?.filter((o) => o.status === "delivered" && o.updated_at.slice(0, 10) === today).length ??
    0;
  const recentOrders = orders
    ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  const isLoading = loadingItems || loadingOrders || loadingTokens;

  const stats = [
    { title: "Total Products", value: totalItems, icon: Package },
    { title: "Active Links", value: activeTokens, icon: LinkIcon },
    { title: "Pending Orders", value: pendingOrders, icon: ShoppingCart },
    { title: "Delivered Today", value: deliveredToday, icon: Truck },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your activity</p>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <motion.div key={stat.title} variants={fadeUpItem}>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </CardTitle>
                    <stat.icon className="size-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <AnimatedCounter value={stat.value} />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
      </motion.div>

      <Separator />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="gap-1">
                View all
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                ))}
              </div>
            ) : recentOrders && recentOrders.length > 0 ? (
              <motion.div
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                animate="animate"
              >
                {recentOrders.map((order) => {
                  const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
                  return (
                    <motion.div
                      key={order.id}
                      variants={fadeUpItem}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {order.address}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(order.created_at)}
                        </p>
                      </div>
                      <Badge className={statusCfg?.badgeClass} variant="secondary">
                        {statusCfg?.label ?? order.status}
                      </Badge>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/tokens" className="block">
              <Button className="w-full justify-start gap-2" variant="default">
                <LinkIcon className="size-4" />
                Generate Link
              </Button>
            </Link>
            <Link href="/inventory" className="block">
              <Button className="w-full justify-start gap-2" variant="outline">
                <Plus className="size-4" />
                Add Product
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
