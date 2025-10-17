"use client";

import { useEffect, useMemo, memo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Clock, Truck, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import { useGpsStore } from "@/stores/gps-store";
import { haversineDistance } from "@/lib/utils/route-optimizer";
import type { OrderStatus, OrderWithItems } from "@/types/database";

interface DriverOrdersResponse {
  assigned: OrderWithItems[];
  pending: OrderWithItems[];
  is_trusted: boolean;
}

async function fetchMyOrders(): Promise<DriverOrdersResponse> {
  const res = await fetch("/api/driver/orders");
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<DriverOrdersResponse>;
}

async function selfAssignOrder(id: string): Promise<void> {
  const res = await fetch(`/api/driver/orders/${id}/self-assign`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to take delivery");
  }
}

function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function timeSinceAssigned(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}m`;
}

// ────────────────────────────────────────────────────────────
// Pull-to-refresh indicator
// ────────────────────────────────────────────────────────────

function PullIndicator({ isRefetching }: { isRefetching: boolean }) {
  if (!isRefetching) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Refreshing...</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main list
// ────────────────────────────────────────────────────────────

export function DriverOrderList() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["driver-orders"],
    queryFn: fetchMyOrders,
    refetchInterval: 30_000,
  });

  const activeOrders = useMemo(() => data?.assigned ?? [], [data]);
  const pendingOrders = useMemo(() => data?.pending ?? [], [data]);
  const isTrusted = data?.is_trusted ?? false;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load orders</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activeOrders.length === 0 && pendingOrders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Package className="size-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium">No deliveries assigned yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New orders will appear here when assigned to you
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PullIndicator isRefetching={isRefetching} />

      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Active ({activeOrders.length})
          </h3>
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {activeOrders.map((order) => (
              <motion.div key={order.id} variants={fadeUpItem}>
                <OrderCard order={order} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {isTrusted && pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Available ({pendingOrders.length})
          </h3>
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {pendingOrders.map((order) => (
              <motion.div key={order.id} variants={fadeUpItem}>
                <OrderCard order={order} showTakeButton />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Order card
// ────────────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({
  order,
  showTakeButton,
}: {
  order: OrderWithItems;
  showTakeButton?: boolean;
}) {
  const gps = useGpsStore();
  const queryClient = useQueryClient();
  const [takePending, setTakePending] = useState(false);

  const config = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const badge = config
    ? { label: config.label, className: config.badgeClass }
    : { label: order.status, className: "bg-muted" };

  // Calculate distance from driver to order
  const distance = useMemo(() => {
    if (!gps.latitude || !gps.longitude || !order.latitude || !order.longitude) return null;
    return haversineDistance(gps.latitude, gps.longitude, order.latitude, order.longitude);
  }, [gps.latitude, gps.longitude, order.latitude, order.longitude]);

  const [isUrgent, setIsUrgent] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsUrgent(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000) > 30);
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const handleTake = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTakePending(true);
      try {
        await selfAssignOrder(order.id);
        queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
        toast.success("Delivery assigned to you");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to take delivery");
      }
      setTakePending(false);
    },
    [order.id, queryClient],
  );

  return (
    <Link href={`/driver/orders/${order.id}`}>
      <Card
        className={`transition-shadow hover:shadow-md active:scale-[0.99] ${isUrgent ? "border-amber-500/50" : ""}`}
      >
        <CardContent className="flex items-start gap-3 py-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
            {order.status === "en_route" ? (
              <Truck className="size-5 text-primary" />
            ) : (
              <Clock className={`size-5 ${isUrgent ? "text-amber-500" : "text-primary"}`} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">#{order.id.slice(0, 8)}</p>
              <Badge className={badge.className} variant="secondary">
                {badge.label}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{order.address}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{order.order_items.length} items</span>
              {distance !== null && (
                <>
                  <span>&middot;</span>
                  <span>{formatDistanceKm(distance)}</span>
                </>
              )}
              <span>&middot;</span>
              <span className={isUrgent ? "font-medium text-amber-600" : ""}>
                {timeSinceAssigned(order.created_at)}
              </span>
            </div>
          </div>

          {showTakeButton && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 self-center"
              onClick={handleTake}
              disabled={takePending}
            >
              {takePending ? <Loader2 className="size-4 animate-spin" /> : "Take"}
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});
"use client";

import { useEffect, useMemo, memo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import { MapPin, Clock, Truck, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import { useGpsStore } from "@/stores/gps-store";
import { haversineDistance } from "@/lib/utils/route-optimizer";
import type { OrderStatus, OrderWithItems } from "@/types/database";

interface DriverOrdersResponse {
  assigned: OrderWithItems[];
  pending: OrderWithItems[];
  is_trusted: boolean;
}

async function fetchMyOrders(): Promise<DriverOrdersResponse> {
  const res = await fetch("/api/driver/orders");
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<DriverOrdersResponse>;
}

async function selfAssignOrder(id: string): Promise<void> {
  const res = await fetch(`/api/driver/orders/${id}/self-assign`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to take delivery");
  }
}

function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

function timeSinceAssigned(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60}m`;
}

// ────────────────────────────────────────────────────────────
// Pull-to-refresh indicator
// ────────────────────────────────────────────────────────────

function PullIndicator({ isRefetching }: { isRefetching: boolean }) {
  if (!isRefetching) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <Loader2 className="size-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Refreshing...</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main list
// ────────────────────────────────────────────────────────────

export function DriverOrderList() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["driver-orders"],
    queryFn: fetchMyOrders,
    refetchInterval: 30_000,
  });

  const activeOrders = useMemo(() => data?.assigned ?? [], [data]);
  const pendingOrders = useMemo(() => data?.pending ?? [], [data]);
  const isTrusted = data?.is_trusted ?? false;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load orders</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (activeOrders.length === 0 && pendingOrders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Package className="size-7 text-muted-foreground/50" />
          </div>
          <div>
            <p className="text-sm font-medium">No deliveries assigned yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New orders will appear here when assigned to you
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PullIndicator isRefetching={isRefetching} />

      {activeOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Active ({activeOrders.length})
          </h3>
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {activeOrders.map((order) => (
              <motion.div key={order.id} variants={fadeUpItem}>
                <OrderCard order={order} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}

      {isTrusted && pendingOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Available ({pendingOrders.length})
          </h3>
          <motion.div
            className="space-y-3"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {pendingOrders.map((order) => (
              <motion.div key={order.id} variants={fadeUpItem}>
                <OrderCard order={order} showTakeButton />
              </motion.div>
            ))}
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Order card
// ────────────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({
  order,
  showTakeButton,
}: {
  order: OrderWithItems;
  showTakeButton?: boolean;
}) {
  const gps = useGpsStore();
  const queryClient = useQueryClient();
  const [takePending, setTakePending] = useState(false);

  const config = ORDER_STATUS_CONFIG[order.status as OrderStatus];
  const badge = config
    ? { label: config.label, className: config.badgeClass }
    : { label: order.status, className: "bg-muted" };

  // Calculate distance from driver to order
  const distance = useMemo(() => {
    if (!gps.latitude || !gps.longitude || !order.latitude || !order.longitude) return null;
    return haversineDistance(gps.latitude, gps.longitude, order.latitude, order.longitude);
  }, [gps.latitude, gps.longitude, order.latitude, order.longitude]);

  const [isUrgent, setIsUrgent] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsUrgent(Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000) > 30);
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const handleTake = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setTakePending(true);
      try {
        await selfAssignOrder(order.id);
        queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
        toast.success("Delivery assigned to you");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to take delivery");
      }
      setTakePending(false);
    },
    [order.id, queryClient],
  );

  return (
    <Link href={`/driver/orders/${order.id}`}>
      <Card
        className={`transition-shadow hover:shadow-md active:scale-[0.99] ${isUrgent ? "border-amber-500/50" : ""}`}
      >
        <CardContent className="flex items-start gap-3 py-3">
          <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
            {order.status === "en_route" ? (
              <Truck className="size-5 text-primary" />
            ) : (
              <Clock className={`size-5 ${isUrgent ? "text-amber-500" : "text-primary"}`} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-medium">#{order.id.slice(0, 8)}</p>
              <Badge className={badge.className} variant="secondary">
                {badge.label}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              <span className="truncate">{order.address}</span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{order.order_items.length} items</span>
              {distance !== null && (
                <>
                  <span>&middot;</span>
                  <span>{formatDistanceKm(distance)}</span>
                </>
              )}
              <span>&middot;</span>
              <span className={isUrgent ? "font-medium text-amber-600" : ""}>
                {timeSinceAssigned(order.created_at)}
              </span>
            </div>
          </div>

          {showTakeButton && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 self-center"
              onClick={handleTake}
              disabled={takePending}
            >
              {takePending ? <Loader2 className="size-4 animate-spin" /> : "Take"}
            </Button>
          )}
        </CardContent>
      </Card>
    </Link>
  );
});
