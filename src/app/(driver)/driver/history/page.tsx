"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, MapPin, Calendar, TrendingUp, Clock, Route, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { formatDate } from "@/lib/utils/helpers";

interface HistoryOrder {
  id: string;
  address: string;
  grade: string;
  status: string;
  created_at: string;
  delivered_at: string | null;
  order_items: { id: string }[];
}

interface ShiftSummary {
  id: string;
  started_at: string;
  ended_at: string | null;
  orders_completed: number;
  total_distance_km: number;
  total_revenue: number;
}

interface HistoryResponse {
  deliveries: HistoryOrder[];
  shifts: ShiftSummary[];
  stats: {
    today: number;
    this_week: number;
    all_time: number;
  };
}

async function fetchHistory(): Promise<HistoryResponse> {
  const res = await fetch("/api/driver/history");
  if (!res.ok) throw new Error("Failed to load history");
  return res.json() as Promise<HistoryResponse>;
}

function formatShiftDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h${mins.toString().padStart(2, "0")}` : `${mins}min`;
}

export default function DriverHistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["driver-history"],
    queryFn: fetchHistory,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = data?.stats ?? { today: 0, this_week: 0, all_time: 0 };
  const deliveries = data?.deliveries ?? [];
  const shifts = data?.shifts ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">History</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{stats.today}</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{stats.this_week}</p>
            <p className="text-xs text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-2xl font-bold">{stats.all_time}</p>
            <p className="text-xs text-muted-foreground">All Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Shift summaries */}
      {shifts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Shifts</h3>
          {shifts.slice(0, 5).map((shift) => (
            <Card key={shift.id}>
              <CardContent className="flex items-center gap-3 py-3">
                <div className="rounded-lg bg-muted p-2">
                  <Clock className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {new Date(shift.started_at).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {shift.ended_at && (
                      <span>{formatShiftDuration(shift.started_at, shift.ended_at)}</span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Package className="size-3" />
                      {shift.orders_completed}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Route className="size-3" />
                      {shift.total_distance_km} km
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delivery list */}
      {deliveries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <TrendingUp className="size-7 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">No completed deliveries yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Deliveries</h3>
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {deliveries.map((delivery) => (
              <motion.div key={delivery.id} variants={fadeUpItem}>
                <Card>
                  <CardContent className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 rounded-lg bg-emerald-500/10 p-2">
                      <Check className="size-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">#{delivery.id.slice(0, 8)}</p>
                        <Badge variant="outline" className="text-emerald-600">
                          Delivered
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="size-3 shrink-0" />
                        <span className="truncate">{delivery.address}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{delivery.order_items.length} items</span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {delivery.delivered_at
                            ? formatDate(delivery.delivered_at)
                            : formatDate(delivery.created_at)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}
