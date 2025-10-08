"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  DollarSign,
  Clock,
  MapPin,
  TrendingUp,
  Calendar,
  Truck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { MfaGate } from "@/components/auth/mfa-gate";

interface DriverProfile {
  id: string;
  username: string;
  phone: string | null;
  vehicle_info: string | null;
  is_active: boolean;
  is_trusted: boolean;
  created_at: string;
}

interface DriverMetrics {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  totalDeliveryFees: number;
  avgDeliveryTime: number;
  totalDistance: number;
  totalShifts: number;
  avgOrdersPerShift: number;
  ordersByDay: { date: string; count: number }[];
  recentShifts: {
    id: string;
    started_at: string;
    ended_at: string | null;
    orders_completed: number;
    total_distance_km: number;
    total_revenue: number;
  }[];
}

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: driver, isLoading: loadingDriver } = useQuery<DriverProfile>({
    queryKey: ["driver", id],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/${id}`);
      if (!res.ok) throw new Error("Failed to load driver");
      return res.json() as Promise<DriverProfile>;
    },
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery<DriverMetrics>({
    queryKey: ["driver-metrics", id],
    queryFn: async () => {
      const res = await fetch(`/api/drivers/${id}/metrics`);
      if (!res.ok) throw new Error("Failed to load metrics");
      return res.json() as Promise<DriverMetrics>;
    },
  });

  const isLoading = loadingDriver || loadingMetrics;

  return (
    <MfaGate>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div variants={fadeUpItem} className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/drivers">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div className="flex-1">
            {loadingDriver ? (
              <Skeleton className="h-8 w-48" />
            ) : driver ? (
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{driver.username}</h1>
                <Badge
                  variant={driver.is_active ? "default" : "secondary"}
                  className={
                    driver.is_active
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : ""
                  }
                >
                  {driver.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            ) : (
              <h1 className="text-2xl font-bold text-muted-foreground">Driver not found</h1>
            )}
            {driver && (
              <p className="text-sm text-muted-foreground">
                Member since {new Date(driver.created_at).toLocaleDateString()}
                {driver.vehicle_info && ` — ${driver.vehicle_info}`}
              </p>
            )}
          </div>
        </motion.div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : metrics ? (
          <>
            {/* Key metrics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={Package}
                label="Deliveries"
                value={metrics.completedOrders.toString()}
                sub={`${metrics.totalOrders} total orders`}
              />
              <MetricCard
                icon={DollarSign}
                label="Total Revenue"
                value={`$${metrics.totalRevenue.toLocaleString()}`}
                sub={`$${metrics.totalDeliveryFees.toLocaleString()} in fees`}
              />
              <MetricCard
                icon={Clock}
                label="Avg Delivery Time"
                value={`${metrics.avgDeliveryTime} min`}
                sub="Per delivery"
              />
              <MetricCard
                icon={MapPin}
                label="Total Distance"
                value={`${metrics.totalDistance} km`}
                sub={`${metrics.totalShifts} shifts completed`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon={TrendingUp}
                label="Avg Orders/Shift"
                value={metrics.avgOrdersPerShift.toString()}
                sub="Per completed shift"
              />
              <MetricCard
                icon={Truck}
                label="Completion Rate"
                value={
                  metrics.totalOrders > 0
                    ? `${Math.round((metrics.completedOrders / metrics.totalOrders) * 100)}%`
                    : "N/A"
                }
                sub={`${metrics.cancelledOrders} cancelled`}
              />
            </div>

            <Separator />

            {/* Deliveries chart (simple bar chart) */}
            <motion.div variants={fadeUpItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="size-4" />
                    Deliveries — Last 14 Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DeliveryChart data={metrics.ordersByDay} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent shifts */}
            {metrics.recentShifts.length > 0 && (
              <motion.div variants={fadeUpItem}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Shifts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {metrics.recentShifts.map((shift) => (
                        <div
                          key={shift.id}
                          className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border p-3 text-sm"
                        >
                          <span className="font-medium">
                            {new Date(shift.started_at).toLocaleDateString()}
                          </span>
                          <span className="text-muted-foreground">
                            {shift.orders_completed} deliveries
                          </span>
                          <span className="text-muted-foreground">
                            {shift.total_distance_km} km
                          </span>
                          <span className="text-muted-foreground">${shift.total_revenue}</span>
                          {shift.ended_at ? (
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {formatDuration(shift.started_at, shift.ended_at)}
                            </Badge>
                          ) : (
                            <Badge className="ml-auto text-xs">Active</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        ) : null}
      </motion.div>
    </MfaGate>
  );
}

// ────────────────────────────────────────────────────────────
// Metric card
// ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <motion.div variants={fadeUpItem}>
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Simple CSS bar chart
// ────────────────────────────────────────────────────────────

function DeliveryChart({ data }: { data: { date: string; count: number }[] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height: 120 }}>
      {data.map((day) => {
        const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
        const label = new Date(day.date + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
        });

        return (
          <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-muted-foreground">
              {day.count > 0 ? day.count : ""}
            </span>
            <div
              className="w-full rounded-t bg-primary/80 transition-all"
              style={{ height: `${Math.max(height, 2)}%` }}
            />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Duration helper
// ────────────────────────────────────────────────────────────

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.round((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
