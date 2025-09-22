"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Trash2, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";

import { ORDER_STATUSES } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/helpers";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import type { Order, OrderStatus, OrderWithItems, Profile } from "@/types/database";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { OrderDetail } from "./order-detail";
import { AssignDriverDialog } from "./assign-driver-dialog";
import { OrdersBulkToolbar } from "./orders-bulk-toolbar";
import { ExportButton } from "@/components/shared/export-button";
import { exportOrdersCSV, exportOrdersExcel } from "@/lib/utils/export";

// ────────────────────────────────────────────────────────────
// Status helpers
// ────────────────────────────────────────────────────────────

const TAB_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type TabFilter = (typeof TAB_FILTERS)[number]["value"];

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

// ────────────────────────────────────────────────────────────
// API functions
// ────────────────────────────────────────────────────────────

type DriverProfile = Pick<Profile, "id" | "username" | "is_active">;

async function fetchOrders(): Promise<OrderWithItems[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<OrderWithItems[]>;
}

async function fetchDrivers(): Promise<DriverProfile[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to load drivers");
  return res.json() as Promise<DriverProfile[]>;
}

async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

async function deleteOrder(orderId: string): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete order");
}

async function bulkUpdateOrderStatus(
  ids: string[],
  status: OrderStatus,
): Promise<{ updated: number; status: string }> {
  const res = await fetch("/api/orders/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error("Failed to bulk-update orders");
  return res.json();
}

async function bulkDeleteOrders(ids: string[]): Promise<void> {
  // No bulk delete endpoint -- delete one-by-one in parallel
  const results = await Promise.allSettled(ids.map(deleteOrder));
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    throw new Error(`Failed to delete ${failures.length} order(s)`);
  }
}

// ────────────────────────────────────────────────────────────
// Status Summary Cards
// ────────────────────────────────────────────────────────────

function StatusSummaryCards({ orders }: { orders: OrderWithItems[] }) {
  const counts: Record<OrderStatus, number> = {
    pending: 0,
    assigned: 0,
    en_route: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const order of orders) {
    counts[order.status]++;
  }

  const statusKeys: OrderStatus[] = ["pending", "assigned", "en_route", "delivered", "cancelled"];

  return (
    <motion.div
      className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {statusKeys.map((status) => {
        const config = ORDER_STATUS_CONFIG[status];
        const Icon = config.icon;

        return (
          <motion.div key={status} variants={fadeUpItem}>
            <Card className="py-3 sm:py-4">
              <CardContent className="flex items-center gap-2 sm:gap-3">
                <div className={`rounded-lg p-1.5 sm:p-2.5 ${config.cardClass}`}>
                  <Icon className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground sm:text-xs">
                    {config.label}
                  </p>
                  <p className="text-lg font-bold sm:text-2xl">{counts[status]}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Order Card
// ────────────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({
  order,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onDelete,
  onSelect,
}: {
  order: OrderWithItems;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onDelete: (orderId: string) => void;
  onSelect: (order: OrderWithItems) => void;
}) {
  const config = ORDER_STATUS_CONFIG[order.status];
  const Icon = config.icon;

  return (
    <Card
      className={`flex flex-col transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(order.id)}
              className="size-3.5 cursor-pointer rounded border-input accent-primary"
              aria-label={`Select order ${truncateId(order.id)}`}
              onClick={(e) => e.stopPropagation()}
            />
            <CardTitle
              className="cursor-pointer text-sm font-mono hover:underline"
              onClick={() => onSelect(order)}
            >
              #{truncateId(order.id)}
            </CardTitle>
          </div>
          <Badge className={config.badgeClass} variant="secondary">
            <Icon className="size-3" />
            {config.label}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{order.address}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{order.grade === "premium" ? "Premium" : "Classic"}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
          {order.total > 0 && (
            <span className="ml-auto text-sm font-semibold tabular-nums">
              ${Number(order.total).toFixed(2)}
            </span>
          )}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Items ({order.order_items.length})
          </p>
          <ul className="space-y-1">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {item.name} <span className="text-muted-foreground">({item.variety})</span>
                </span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {item.quantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        <Select
          value={order.status}
          onValueChange={(value: string) => {
            onStatusChange(order.id, value as OrderStatus);
          }}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {ORDER_STATUS_CONFIG[s.value as OrderStatus]?.label ?? s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {order.status !== "delivered" && order.status !== "cancelled" && (
          <AssignDriverDialog
            orderId={order.id}
            currentDriverId={order.assigned_driver_id ?? null}
          />
        )}

        <Button variant="destructive" size="icon-sm" onClick={() => onDelete(order.id)}>
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </CardFooter>
    </Card>
  );
});

// ────────────────────────────────────────────────────────────
// Loading state
// ────────────────────────────────────────────────────────────

function OrdersPanelLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full sm:w-96" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

export function OrdersPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const driverParam = searchParams.get("driver");

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<string>(driverParam ?? "all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previous = queryClient.getQueryData<OrderWithItems[]>(["orders"]);
      queryClient.setQueryData<OrderWithItems[]>(
        ["orders"],
        (old) => old?.map((o) => (o.id === orderId ? { ...o, status } : o)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["orders"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onSuccess: () => {
      toast.success("Status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrder,
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previous = queryClient.getQueryData<OrderWithItems[]>(["orders"]);
      queryClient.setQueryData<OrderWithItems[]>(
        ["orders"],
        (old) => old?.filter((o) => o.id !== orderId) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["orders"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Order deleted");
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrderStatus }) =>
      bulkUpdateOrderStatus(ids, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      toast.success(`${data.updated} order${data.updated > 1 ? "s" : ""} updated`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteOrders,
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} order${ids.length > 1 ? "s" : ""} deleted`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleStatusChange(orderId: string, status: OrderStatus) {
    statusMutation.mutate({ orderId, status });
  }

  function handleDeleteRequest(orderId: string) {
    setDeleteTarget(orderId);
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
    }
  }

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (activeTab !== "all") {
      result = result.filter((o) => o.status === activeTab);
    }
    if (selectedDriverId !== "all") {
      result = result.filter((o) => o.assigned_driver_id === selectedDriverId);
    }
    return result;
  }, [orders, activeTab, selectedDriverId]);

  const allVisibleSelected = useMemo(
    () => filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id)),
    [filteredOrders, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => filteredOrders.some((o) => selectedIds.has(o.id)) && !allVisibleSelected,
    [filteredOrders, selectedIds, allVisibleSelected],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredOrders.map((o) => o.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [filteredOrders]);

  function handleBulkStatusChange(status: OrderStatus) {
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status });
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }

  if (isLoading) return <OrdersPanelLoading />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load orders"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StatusSummaryCards orders={orders} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="w-max">
              {TAB_FILTERS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({statusCounts[tab.value] ?? 0})
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filteredOrders.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="size-3.5 cursor-pointer rounded border-input accent-primary"
                  aria-label="Select all orders"
                />
                Select all
              </label>
            )}
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="w-full sm:w-[180px]" size="sm">
                <Truck className="size-3.5" />
                <SelectValue placeholder="Filter by driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              onExportCSV={() =>
                exportOrdersCSV(
                  filteredOrders.map((o) => ({
                    id: o.id,
                    address: o.address,
                    status: o.status,
                    grade: o.grade,
                    notes: o.notes,
                    created_at: o.created_at,
                    items: o.order_items.map((item) => ({
                      name: item.name,
                      variety: item.variety,
                      quantity: item.quantity,
                      unit: item.unit,
                    })),
                  })),
                )
              }
              onExportExcel={() =>
                exportOrdersExcel(
                  filteredOrders.map((o) => ({
                    id: o.id,
                    address: o.address,
                    status: o.status,
                    grade: o.grade,
                    notes: o.notes,
                    created_at: o.created_at,
                    items: o.order_items.map((item) => ({
                      name: item.name,
                      variety: item.variety,
                      quantity: item.quantity,
                      unit: item.unit,
                    })),
                  })),
                )
              }
              disabled={filteredOrders.length === 0}
            />
          </div>
        </div>

        {TAB_FILTERS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <AnimatePresence mode="wait">
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No orders found</p>
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  key={tab.value}
                >
                  {filteredOrders.map((order) => (
                    <motion.div key={order.id} variants={fadeUpItem}>
                      <OrderCard
                        order={order}
                        isSelected={selectedIds.has(order.id)}
                        onToggleSelect={toggleSelectItem}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteRequest}
                        onSelect={setSelectedOrder}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>

      {/* Bulk actions toolbar */}
      <OrdersBulkToolbar
        selectedCount={selectedIds.size}
        onStatusChange={handleBulkStatusChange}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedIds(new Set())}
        isUpdating={bulkStatusMutation.isPending}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order detail dialog */}
      <OrderDetail
        order={selectedOrder}
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        onStatusChange={handleStatusChange}
        onDelete={(orderId) => {
          setSelectedOrder(null);
          handleDeleteRequest(orderId);
        }}
      />
    </div>
  );
}
"use client";

import { useState, useMemo, useCallback, memo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, Trash2, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";

import { ORDER_STATUSES } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/helpers";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import type { Order, OrderStatus, OrderWithItems, Profile } from "@/types/database";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { OrderDetail } from "./order-detail";
import { AssignDriverDialog } from "./assign-driver-dialog";
import { OrdersBulkToolbar } from "./orders-bulk-toolbar";
import { ExportButton } from "@/components/shared/export-button";
import { exportOrdersCSV, exportOrdersExcel } from "@/lib/utils/export";

// ────────────────────────────────────────────────────────────
// Status helpers
// ────────────────────────────────────────────────────────────

const TAB_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "assigned", label: "Assigned" },
  { value: "en_route", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

type TabFilter = (typeof TAB_FILTERS)[number]["value"];

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

// ────────────────────────────────────────────────────────────
// API functions
// ────────────────────────────────────────────────────────────

type DriverProfile = Pick<Profile, "id" | "username" | "is_active">;

async function fetchOrders(): Promise<OrderWithItems[]> {
  const res = await fetch("/api/orders");
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json() as Promise<OrderWithItems[]>;
}

async function fetchDrivers(): Promise<DriverProfile[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to load drivers");
  return res.json() as Promise<DriverProfile[]>;
}

async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

async function deleteOrder(orderId: string): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete order");
}

async function bulkUpdateOrderStatus(
  ids: string[],
  status: OrderStatus,
): Promise<{ updated: number; status: string }> {
  const res = await fetch("/api/orders/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, status }),
  });
  if (!res.ok) throw new Error("Failed to bulk-update orders");
  return res.json();
}

async function bulkDeleteOrders(ids: string[]): Promise<void> {
  // No bulk delete endpoint -- delete one-by-one in parallel
  const results = await Promise.allSettled(ids.map(deleteOrder));
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    throw new Error(`Failed to delete ${failures.length} order(s)`);
  }
}

// ────────────────────────────────────────────────────────────
// Status Summary Cards
// ────────────────────────────────────────────────────────────

function StatusSummaryCards({ orders }: { orders: OrderWithItems[] }) {
  const counts: Record<OrderStatus, number> = {
    pending: 0,
    assigned: 0,
    en_route: 0,
    delivered: 0,
    cancelled: 0,
  };

  for (const order of orders) {
    counts[order.status]++;
  }

  const statusKeys: OrderStatus[] = ["pending", "assigned", "en_route", "delivered", "cancelled"];

  return (
    <motion.div
      className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {statusKeys.map((status) => {
        const config = ORDER_STATUS_CONFIG[status];
        const Icon = config.icon;

        return (
          <motion.div key={status} variants={fadeUpItem}>
            <Card className="py-3 sm:py-4">
              <CardContent className="flex items-center gap-2 sm:gap-3">
                <div className={`rounded-lg p-1.5 sm:p-2.5 ${config.cardClass}`}>
                  <Icon className="size-4 sm:size-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-medium leading-tight text-muted-foreground sm:text-xs">
                    {config.label}
                  </p>
                  <p className="text-lg font-bold sm:text-2xl">{counts[status]}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Order Card
// ────────────────────────────────────────────────────────────

const OrderCard = memo(function OrderCard({
  order,
  isSelected,
  onToggleSelect,
  onStatusChange,
  onDelete,
  onSelect,
}: {
  order: OrderWithItems;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onDelete: (orderId: string) => void;
  onSelect: (order: OrderWithItems) => void;
}) {
  const config = ORDER_STATUS_CONFIG[order.status];
  const Icon = config.icon;

  return (
    <Card
      className={`flex flex-col transition-shadow hover:shadow-md ${isSelected ? "ring-2 ring-primary/50" : ""}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(order.id)}
              className="size-3.5 cursor-pointer rounded border-input accent-primary"
              aria-label={`Select order ${truncateId(order.id)}`}
              onClick={(e) => e.stopPropagation()}
            />
            <CardTitle
              className="cursor-pointer text-sm font-mono hover:underline"
              onClick={() => onSelect(order)}
            >
              #{truncateId(order.id)}
            </CardTitle>
          </div>
          <Badge className={config.badgeClass} variant="secondary">
            <Icon className="size-3" />
            {config.label}
          </Badge>
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{order.address}</span>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{order.grade === "premium" ? "Premium" : "Classic"}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(order.created_at)}</span>
          {order.total > 0 && (
            <span className="ml-auto text-sm font-semibold tabular-nums">
              ${Number(order.total).toFixed(2)}
            </span>
          )}
        </div>

        <Separator />

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Items ({order.order_items.length})
          </p>
          <ul className="space-y-1">
            {order.order_items.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {item.name} <span className="text-muted-foreground">({item.variety})</span>
                </span>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {item.quantity} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex-wrap gap-2">
        <Select
          value={order.status}
          onValueChange={(value: string) => {
            onStatusChange(order.id, value as OrderStatus);
          }}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {ORDER_STATUS_CONFIG[s.value as OrderStatus]?.label ?? s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {order.status !== "delivered" && order.status !== "cancelled" && (
          <AssignDriverDialog
            orderId={order.id}
            currentDriverId={order.assigned_driver_id ?? null}
          />
        )}

        <Button variant="destructive" size="icon-sm" onClick={() => onDelete(order.id)}>
          <Trash2 className="size-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </CardFooter>
    </Card>
  );
});

// ────────────────────────────────────────────────────────────
// Loading state
// ────────────────────────────────────────────────────────────

function OrdersPanelLoading() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full sm:w-96" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

export function OrdersPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const driverParam = searchParams.get("driver");

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [selectedDriverId, setSelectedDriverId] = useState<string>(driverParam ?? "all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const {
    data: orders = [],
    isLoading,
    isError,
    error,
  } = useQuery<OrderWithItems[]>({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  const { data: drivers = [] } = useQuery<DriverProfile[]>({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      updateOrderStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previous = queryClient.getQueryData<OrderWithItems[]>(["orders"]);
      queryClient.setQueryData<OrderWithItems[]>(
        ["orders"],
        (old) => old?.map((o) => (o.id === orderId ? { ...o, status } : o)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["orders"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onSuccess: () => {
      toast.success("Status updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteOrder,
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: ["orders"] });
      const previous = queryClient.getQueryData<OrderWithItems[]>(["orders"]);
      queryClient.setQueryData<OrderWithItems[]>(
        ["orders"],
        (old) => old?.filter((o) => o.id !== orderId) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["orders"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onSuccess: () => {
      setDeleteTarget(null);
      toast.success("Order deleted");
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrderStatus }) =>
      bulkUpdateOrderStatus(ids, status),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      toast.success(`${data.updated} order${data.updated > 1 ? "s" : ""} updated`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteOrders,
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} order${ids.length > 1 ? "s" : ""} deleted`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleStatusChange(orderId: string, status: OrderStatus) {
    statusMutation.mutate({ orderId, status });
  }

  function handleDeleteRequest(orderId: string) {
    setDeleteTarget(orderId);
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget);
    }
  }

  const toggleSelectItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      counts[order.status] = (counts[order.status] ?? 0) + 1;
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (activeTab !== "all") {
      result = result.filter((o) => o.status === activeTab);
    }
    if (selectedDriverId !== "all") {
      result = result.filter((o) => o.assigned_driver_id === selectedDriverId);
    }
    return result;
  }, [orders, activeTab, selectedDriverId]);

  const allVisibleSelected = useMemo(
    () => filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id)),
    [filteredOrders, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => filteredOrders.some((o) => selectedIds.has(o.id)) && !allVisibleSelected,
    [filteredOrders, selectedIds, allVisibleSelected],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredOrders.map((o) => o.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [filteredOrders]);

  function handleBulkStatusChange(status: OrderStatus) {
    bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status });
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }

  if (isLoading) return <OrdersPanelLoading />;

  if (isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Failed to load orders"}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <StatusSummaryCards orders={orders} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabFilter)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="overflow-x-auto scrollbar-hide">
            <TabsList className="w-max">
              {TAB_FILTERS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({statusCounts[tab.value] ?? 0})
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filteredOrders.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="size-3.5 cursor-pointer rounded border-input accent-primary"
                  aria-label="Select all orders"
                />
                Select all
              </label>
            )}
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="w-full sm:w-[180px]" size="sm">
                <Truck className="size-3.5" />
                <SelectValue placeholder="Filter by driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ExportButton
              onExportCSV={() =>
                exportOrdersCSV(
                  filteredOrders.map((o) => ({
                    id: o.id,
                    address: o.address,
                    status: o.status,
                    grade: o.grade,
                    notes: o.notes,
                    created_at: o.created_at,
                    items: o.order_items.map((item) => ({
                      name: item.name,
                      variety: item.variety,
                      quantity: item.quantity,
                      unit: item.unit,
                    })),
                  })),
                )
              }
              onExportExcel={() =>
                exportOrdersExcel(
                  filteredOrders.map((o) => ({
                    id: o.id,
                    address: o.address,
                    status: o.status,
                    grade: o.grade,
                    notes: o.notes,
                    created_at: o.created_at,
                    items: o.order_items.map((item) => ({
                      name: item.name,
                      variety: item.variety,
                      quantity: item.quantity,
                      unit: item.unit,
                    })),
                  })),
                )
              }
              disabled={filteredOrders.length === 0}
            />
          </div>
        </div>

        {TAB_FILTERS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <AnimatePresence mode="wait">
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center">
                    <ShoppingCart className="mx-auto size-10 text-muted-foreground" />
                    <p className="mt-2 text-sm text-muted-foreground">No orders found</p>
                  </CardContent>
                </Card>
              ) : (
                <motion.div
                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  key={tab.value}
                >
                  {filteredOrders.map((order) => (
                    <motion.div key={order.id} variants={fadeUpItem}>
                      <OrderCard
                        order={order}
                        isSelected={selectedIds.has(order.id)}
                        onToggleSelect={toggleSelectItem}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDeleteRequest}
                        onSelect={setSelectedOrder}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>

      {/* Bulk actions toolbar */}
      <OrdersBulkToolbar
        selectedCount={selectedIds.size}
        onStatusChange={handleBulkStatusChange}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedIds(new Set())}
        isUpdating={bulkStatusMutation.isPending}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order detail dialog */}
      <OrderDetail
        order={selectedOrder}
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedOrder(null);
        }}
        onStatusChange={handleStatusChange}
        onDelete={(orderId) => {
          setSelectedOrder(null);
          handleDeleteRequest(orderId);
        }}
      />
    </div>
  );
}
