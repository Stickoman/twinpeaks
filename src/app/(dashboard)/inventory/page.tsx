import type { Metadata } from "next";
import { Suspense } from "react";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InventoryTable } from "@/components/inventory";

export const metadata: Metadata = {
  title: "Inventory",
};

function InventoryTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-72" />
      </div>
      <div className="rounded-md border">
        <div className="border-b p-4">
          <div className="flex gap-6">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b p-4">
            <Skeleton className="size-10 rounded" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-8 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Package className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
        </div>
        <p className="text-muted-foreground">
          Manage your product inventory. Add, edit, or remove items.
        </p>
      </div>

      <Suspense fallback={<InventoryTableSkeleton />}>
        <InventoryTable />
      </Suspense>
    </div>
  );
}
