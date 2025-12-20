"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ShoppingCart, Clock, Check, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, fadeUpItem, counterConfig } from "@/lib/motion";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
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

interface StatsData {
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

function formatDayLabel(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
  });
}

// ────────────────────────────────────────────────────────────
// Animated Counter
// ────────────────────────────────────────────────────────────

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const { duration } = counterConfig;
    const totalMs = duration * 1000;
    const steps = 30;
    const stepDuration = totalMs / steps;
    let current = 0;

    const interval = setInterval(() => {
      current++;
      setDisplay(Math.round((current / steps) * value));
      if (current >= steps) {
        setDisplay(value);
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [value, isInView]);

  return (
    <motion.p
      ref={ref}
      className="text-3xl font-bold"
      initial={{ opacity: 0, y: 8 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4 }}
    >
      {display}
    </motion.p>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function StatsOverview() {
  const { data, isLoading, isError, error, refetch } = useQuery<StatsData>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load statistics");
      return res.json() as Promise<StatsData>;
    },
    staleTime: 60_000,
  });

  const barData = useMemo(
    () =>
      (data?.orders_by_day ?? []).map((d) => ({
        ...d,
        label: formatDayLabel(d.date),
      })),
    [data?.orders_by_day],
  );

  const pieData = useMemo(
    () =>
      (data?.orders_by_status ?? [])
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: ORDER_STATUS_CONFIG[s.status].label,
          value: s.count,
          color: ORDER_STATUS_CONFIG[s.status].color,
        })),
    [data?.orders_by_status],
  );

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 pt-6">
          <p className="text-destructive text-center">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !data) {
    return <StatsLoadingSkeleton />;
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Metric Cards */}
      <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={staggerContainer}>
        <motion.div variants={fadeUpItem}>
          <MetricCard
            title="Total Orders"
            value={data.total_orders}
            icon={<ShoppingCart className="size-5 text-muted-foreground" />}
          />
        </motion.div>
        <motion.div variants={fadeUpItem}>
          <MetricCard
            title="Pending"
            value={data.pending_orders}
            icon={<Clock className="size-5 text-amber-500" />}
          />
        </motion.div>
        <motion.div variants={fadeUpItem}>
          <MetricCard
            title="Delivered"
            value={data.delivered_orders}
            icon={<Check className="size-5 text-emerald-500" />}
          />
        </motion.div>
        <motion.div variants={fadeUpItem}>
          <MetricCard
            title="Products in Stock"
            value={data.products_in_stock}
            icon={<Package className="size-5 text-blue-500" />}
          />
        </motion.div>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart - Orders per day */}
        <motion.div variants={fadeUpItem}>
          <ChartCard title="Orders per Day" description="Last 7 days">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      color: "hsl(var(--card-foreground))",
                    }}
                    labelFormatter={(label) => String(label)}
                    formatter={(value) => [String(value), "Orders"]}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Orders" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </motion.div>

        {/* Pie Chart - Orders by status */}
        <motion.div variants={fadeUpItem}>
          <ChartCard title="Status Distribution" description="Order breakdown by status">
            <div className="h-[300px] w-full">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-muted-foreground">No orders to display</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ percent }: { percent?: number }) =>
                        `${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value) => [String(value), "Orders"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {data.orders_by_status.map((s) => (
                <div key={s.status} className="flex items-center gap-2">
                  <div
                    className="size-3 rounded-full"
                    style={{ backgroundColor: ORDER_STATUS_CONFIG[s.status].color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {ORDER_STATUS_CONFIG[s.status].label} ({s.count})
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </motion.div>
      </div>

      {/* Top Products */}
      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle>Most Ordered Products</CardTitle>
            <CardDescription>Top 5 products by total quantity ordered</CardDescription>
          </CardHeader>
          <CardContent>
            {data.top_products.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No orders recorded yet</p>
            ) : (
              <motion.div
                className="space-y-3"
                variants={staggerContainer}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
              >
                {data.top_products.map((product, index) => (
                  <motion.div
                    key={`${product.name}-${product.variety}`}
                    variants={fadeUpItem}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{product.name}</p>
                        <p className="truncate text-sm text-muted-foreground">{product.variety}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold">
                      {product.total_ordered} ordered
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
}

function MetricCard({ title, value, icon }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <AnimatedCounter value={value} />
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────
// Loading Skeleton
// ────────────────────────────────────────────────────────────

function StatsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="size-5 rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
