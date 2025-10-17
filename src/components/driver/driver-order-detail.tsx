"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, Package, ArrowLeft, Truck, Check, Bell } from "lucide-react";
import { toast } from "sonner";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";

import { useMapTheme } from "@/hooks/use-map-theme";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/helpers";
import { DeliveryConfirmSheet } from "./delivery-confirm-sheet";
import type { OrderWithItems } from "@/types/database";

interface DriverOrdersCache {
  is_trusted: boolean;
}

async function fetchOrder(id: string): Promise<OrderWithItems> {
  const res = await fetch(`/api/driver/orders/${id}`);
  if (!res.ok) throw new Error("Failed to load order");
  return res.json() as Promise<OrderWithItems>;
}

async function startDelivery(id: string): Promise<void> {
  const res = await fetch(`/api/driver/orders/${id}/start`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to start delivery");
}

async function selfAssignOrder(id: string): Promise<void> {
  const res = await fetch(`/api/driver/orders/${id}/self-assign`, { method: "POST" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to take delivery");
  }
}

async function notifyCustomer(id: string, message: string): Promise<boolean> {
  const res = await fetch(`/api/driver/orders/${id}/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error("Failed to send notification");
  const data = (await res.json()) as { sent: boolean };
  return data.sent;
}

export function DriverOrderDetail({ orderId }: { orderId: string }) {
  const { styles: mapStyles } = useMapTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cachedList = queryClient.getQueryData<DriverOrdersCache>(["driver-orders"]);
  const isTrusted = cachedList?.is_trusted ?? false;

  const { data: order, isLoading } = useQuery({
    queryKey: ["driver-order", orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const startMutation = useMutation({
    mutationFn: () => startDelivery(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
      toast.success("Delivery started");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notifyMutation = useMutation({
    mutationFn: (message: string) => notifyCustomer(orderId, message),
    onSuccess: (sent) => {
      if (sent) {
        toast.success("Customer notified");
      } else {
        toast("Customer has no push subscription", {
          description: "They may not have enabled notifications.",
        });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selfAssignMutation = useMutation({
    mutationFn: () => selfAssignOrder(orderId),
    onSuccess: () => {
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["driver-order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
      toast.success("Delivery assigned to you");
    },
    onError: (err: Error) => {
      setConfirmOpen(false);
      toast.error(err.message);
    },
  });

  const openNavigation = () => {
    if (!order) return;
    if (order.latitude && order.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${order.latitude},${order.longitude}&travelmode=driving`,
        "_blank",
      );
    } else {
      const encoded = encodeURIComponent(order.address);
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Order not found</div>;
  }

  const hasCoords = order.latitude != null && order.longitude != null;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-bold">Order #{order.id.slice(0, 8)}</h2>
          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
        </div>
      </div>

      {/* Mini-map */}
      {hasCoords && (
        <div className="overflow-hidden rounded-xl border">
          <Map
            className="h-40 w-full"
            defaultCenter={{ lat: order.latitude!, lng: order.longitude! }}
            defaultZoom={15}
            gestureHandling="none"
            disableDefaultUI
            styles={mapStyles}
          >
            <AdvancedMarker
              position={{ lat: order.latitude!, lng: order.longitude! }}
              title={order.address}
            >
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg">
                <MapPin className="size-4 text-primary-foreground" />
              </div>
            </AdvancedMarker>
          </Map>
        </div>
      )}

      {/* Address + Actions */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">{order.address}</p>
              <Badge variant="outline" className="mt-1">
                {order.grade === "premium" ? "Premium" : "Classic"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" className="w-full" onClick={openNavigation}>
            <Navigation className="size-4" />
            Navigate
          </Button>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Package className="size-4" />
            Items ({order.order_items.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.variety}</p>
                </div>
                <span className="ml-2 shrink-0 text-muted-foreground">
                  {item.quantity} {item.unit}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {order.notes && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <p className="mt-1 text-sm">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 z-40 border-t bg-background p-4 pb-[env(safe-area-inset-bottom)]">
        {order.status === "pending" && isTrusted && (
          <>
            <Button className="w-full" size="lg" onClick={() => setConfirmOpen(true)}>
              <Truck className="size-5" />
              Take this Delivery
            </Button>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>Take this delivery?</DialogTitle>
                  <DialogDescription>
                    You will be assigned to order #{order.id.slice(0, 8)} and responsible for
                    delivering it.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmOpen(false)}
                    disabled={selfAssignMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => selfAssignMutation.mutate()}
                    disabled={selfAssignMutation.isPending}
                  >
                    <Check className="size-4" />
                    {selfAssignMutation.isPending ? "Assigning..." : "Confirm"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}

        {order.status === "assigned" && (
          <Button
            className="w-full"
            size="lg"
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
          >
            <Truck className="size-5" />
            {startMutation.isPending ? "Starting..." : "Start Delivery"}
          </Button>
        )}

        {order.status === "en_route" && (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              size="lg"
              onClick={() => notifyMutation.mutate("Your driver is arriving in about 5 minutes!")}
              disabled={notifyMutation.isPending}
            >
              <Bell className="size-4" />
              {notifyMutation.isPending ? "Sending..." : "Notify: Arriving in 5 min"}
            </Button>
            <DeliveryConfirmSheet orderId={order.id} />
          </div>
        )}

        {order.status === "delivered" && (
          <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
            <Check className="size-5 text-emerald-600" />
            <span className="font-medium text-emerald-600">Delivered</span>
          </div>
        )}
      </div>
    </div>
  );
}
