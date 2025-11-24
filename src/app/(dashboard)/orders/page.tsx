import type { Metadata } from "next";
import { Suspense } from "react";
import { ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OrdersPanel } from "@/components/orders";

export const metadata: Metadata = {
  title: "Orders",
};

function OrdersPanelSkeleton() {
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

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShoppingCart className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        </div>
        <p className="text-sm text-muted-foreground sm:text-base">
          Track and manage customer orders. Update statuses and view details.
        </p>
      </div>

      <Suspense fallback={<OrdersPanelSkeleton />}>
        <OrdersPanel />
      </Suspense>
    </div>
  );
}
