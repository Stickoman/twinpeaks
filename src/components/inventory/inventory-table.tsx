"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Upload,
  PackagePlus,
  DollarSign,
} from "lucide-react";

import type { Item } from "@/types/database";
import { getAvailabilityStatus, getAvailabilityBadgeConfig } from "@/lib/utils/stock";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryForm } from "./inventory-form";
import { RestockDialog } from "./restock-dialog";
import { PricingTiersEditor } from "./pricing-tiers-editor";
import { ExportButton } from "@/components/shared/export-button";
import { ImportDialog } from "./import-dialog";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkAddDialog } from "./bulk-add-dialog";
import { exportItemsCSV, exportItemsExcel } from "@/lib/utils/export";

// ────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────

async function fetchItems(): Promise<Item[]> {
  const response = await fetch("/api/inventory");
  if (!response.ok) throw new Error("Failed to load inventory");
  return response.json() as Promise<Item[]>;
}

async function deleteItem(id: string): Promise<void> {
  const response = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete product");
}

async function bulkDeleteItems(ids: string[]): Promise<void> {
  const response = await fetch("/api/inventory/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error("Failed to delete products");
}

async function bulkUpdateItems(
  payload: { id: string; data: Record<string, unknown> }[],
): Promise<{ succeeded: unknown[]; failed: { id: string; error: string }[] }> {
  const response = await fetch("/api/inventory/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update products");
  return response.json() as Promise<{
    succeeded: unknown[];
    failed: { id: string; error: string }[];
  }>;
}

// ────────────────────────────────────────────────────────────
// Loading skeleton
// ────────────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-8 px-2 sm:w-10 sm:px-4">
        <Skeleton className="size-4 rounded" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="size-8 rounded sm:size-10" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="hidden px-2 sm:table-cell sm:px-4">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="hidden px-2 text-right sm:table-cell sm:px-4">
        <Skeleton className="ml-auto h-4 w-14" />
      </TableCell>
      <TableCell className="px-2 text-right sm:px-4">
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell className="sticky right-0 bg-background px-2 sm:px-4">
        <Skeleton className="size-8" />
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function InventoryTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [restockingItem, setRestockingItem] = useState<Item | null>(null);
  const [pricingItem, setPricingItem] = useState<Item | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingImage, setViewingImage] = useState<Item | null>(null);

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: fetchItems,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDeletingItem(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteItems,
    onSuccess: (_data, ids) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} product${ids.length > 1 ? "s" : ""} deleted`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateItems,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedIds(new Set());
      const count = result.succeeded.length;
      if (result.failed.length > 0) {
        toast.warning(
          `${count} product${count > 1 ? "s" : ""} updated, ${result.failed.length} failed`,
        );
      } else {
        toast.success(`${count} product${count > 1 ? "s" : ""} updated`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    },
  });

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const query = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.variety.toLowerCase().includes(query) ||
          (item.type?.toLowerCase().includes(query) ?? false)
        );
      }),
    [items, search],
  );

  const existingItems = useMemo(
    () => items.map((i) => ({ name: i.name, variety: i.variety })),
    [items],
  );

  const allVisibleSelected = useMemo(
    () => filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id)),
    [filteredItems, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => filteredItems.some((item) => selectedIds.has(item.id)) && !allVisibleSelected,
    [filteredItems, selectedIds, allVisibleSelected],
  );

  function handleFormSuccess() {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setIsCreateOpen(false);
    setEditingItem(null);
  }

  function handleConfirmDelete() {
    if (deletingItem) {
      deleteMutation.mutate(deletingItem.id);
    }
  }

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredItems.map((item) => item.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [filteredItems]);

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

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }

  function handleBulkEdit(data: Record<string, unknown>) {
    const ids = Array.from(selectedIds);
    const payload = ids.map((id) => ({ id, data }));
    bulkUpdateMutation.mutate(payload);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportItemsCSV(items)}
            onExportExcel={() => exportItemsExcel(items)}
            disabled={items.length === 0}
          />
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="size-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsBulkAddOpen(true)}>
            <PackagePlus className="size-4" />
            <span className="hidden sm:inline">Bulk Add</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive dark:bg-destructive/20">
          {error instanceof Error ? error.message : "An error occurred while loading."}
        </div>
      )}

      {/* Bulk actions toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onBulkEdit={handleBulkEdit}
        onClear={() => setSelectedIds(new Set())}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2 sm:w-10 sm:px-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="size-4 cursor-pointer rounded border-input accent-primary"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[40px] px-2 sm:w-[60px] sm:px-4">Image</TableHead>
              <TableHead className="px-2 sm:px-4">Name</TableHead>
              <TableHead className="hidden px-2 sm:table-cell sm:px-4">Type</TableHead>
              <TableHead className="hidden px-2 text-right sm:table-cell sm:px-4">Price</TableHead>
              <TableHead className="px-2 text-right sm:px-4">Qty</TableHead>
              <TableHead className="px-2 sm:px-4">Stock</TableHead>
              <TableHead className="sticky right-0 w-[48px] bg-background px-2 sm:w-[60px] sm:px-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}

            {!isLoading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <Package className="size-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? "No products match your search." : "No products in inventory."}
                    </p>
                    {!search && (
                      <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="size-4" />
                        Add Product
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            <AnimatePresence>
              {!isLoading &&
                filteredItems.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    onClick={() => setEditingItem(item)}
                  >
                    {/* Checkbox */}
                    <TableCell
                      className="w-8 px-2 sm:w-10 sm:px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="size-4 cursor-pointer rounded border-input accent-primary"
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>

                    {/* Thumbnail */}
                    <TableCell
                      className="px-2 sm:px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.image_url) setViewingImage(item);
                      }}
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={40}
                          height={40}
                          className="size-8 cursor-zoom-in rounded object-cover sm:size-10"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded bg-muted sm:size-10 dark:bg-muted/50">
                          <Package className="size-4 text-muted-foreground sm:size-5" />
                        </div>
                      )}
                    </TableCell>

                    {/* Name + variety (variety shown below name on mobile) */}
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm font-medium sm:text-base">{item.name}</span>
                          {item.is_featured && (
                            <Badge variant="default" className="hidden text-[10px] sm:inline-flex">
                              FEATURED
                            </Badge>
                          )}
                          {item.badges?.map((badge: string) => (
                            <Badge
                              key={badge}
                              variant="secondary"
                              className={`hidden sm:inline-flex text-[10px] ${
                                badge === "PREMIUM"
                                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                  : badge === "BESTSELLER"
                                    ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                                    : badge === "LIMITED"
                                      ? "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                      : badge === "SEASONAL"
                                        ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                                        : badge === "PROMO"
                                          ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                                          : "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              }`}
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{item.variety}</span>
                        {/* Price + Type shown only on mobile (hidden on sm+) */}
                        <span className="flex items-center gap-1 sm:hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            ${Number(item.price).toFixed(2)}
                          </span>
                          {item.type && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.type}
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    {/* Type — hidden on mobile, visible from sm */}
                    <TableCell className="hidden px-2 sm:table-cell sm:px-4">
                      {item.type ? (
                        <Badge variant="secondary">{item.type}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Price — hidden on mobile, visible from sm */}
                    <TableCell className="hidden px-2 text-right tabular-nums sm:table-cell sm:px-4">
                      <span className="text-sm">${Number(item.price).toFixed(2)}</span>
                    </TableCell>

                    <TableCell className="px-2 text-right tabular-nums sm:px-4">
                      <span className="text-sm">{item.quantity}</span>
                      <span className="ml-0.5 hidden text-xs text-muted-foreground md:inline">
                        {item.unit_measure}
                      </span>
                    </TableCell>

                    <TableCell className="px-2 sm:px-4">
                      {(() => {
                        const availability = getAvailabilityStatus(
                          item.quantity,
                          item.low_stock_threshold,
                          null,
                        );
                        const badge = getAvailabilityBadgeConfig(availability);
                        return (
                          <Badge
                            variant="secondary"
                            className={`whitespace-nowrap text-[10px] sm:text-xs ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell
                      className="sticky right-0 bg-background px-2 sm:px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingItem(item)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRestockingItem(item)}>
                            <PackagePlus className="size-4" />
                            Restock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPricingItem(item)}>
                            <DollarSign className="size-4" />
                            Pricing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <BulkAddDialog
        open={isBulkAddOpen}
        onOpenChange={setIsBulkAddOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["inventory"] });
        }}
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Fill in the new product details.</DialogDescription>
          </DialogHeader>
          <InventoryForm onSuccess={handleFormSuccess} onCancel={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details.</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <InventoryForm
              item={editingItem}
              onSuccess={handleFormSuccess}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deletingItem?.name}</span> ({deletingItem?.variety})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing tiers editor */}
      <PricingTiersEditor
        item={pricingItem}
        open={pricingItem !== null}
        onOpenChange={(open) => {
          if (!open) setPricingItem(null);
        }}
      />

      {/* Restock dialog */}
      <RestockDialog
        item={restockingItem}
        open={restockingItem !== null}
        onOpenChange={(open) => {
          if (!open) setRestockingItem(null);
        }}
      />

      {/* Image viewer */}
      <Dialog
        open={viewingImage !== null}
        onOpenChange={(open) => {
          if (!open) setViewingImage(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewingImage?.name} &mdash; {viewingImage?.variety}
            </DialogTitle>
          </DialogHeader>
          {viewingImage?.image_url && (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg">
              <Image
                src={viewingImage.image_url}
                alt={viewingImage.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingImage(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setEditingItem(viewingImage);
                setViewingImage(null);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingItems={existingItems}
      />
    </div>
  );
}
"use client";

import { useState, useMemo, useCallback } from "react";
import Image from "next/image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Upload,
  PackagePlus,
  DollarSign,
} from "lucide-react";

import type { Item } from "@/types/database";
import { getAvailabilityStatus, getAvailabilityBadgeConfig } from "@/lib/utils/stock";

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryForm } from "./inventory-form";
import { RestockDialog } from "./restock-dialog";
import { PricingTiersEditor } from "./pricing-tiers-editor";
import { ExportButton } from "@/components/shared/export-button";
import { ImportDialog } from "./import-dialog";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { BulkAddDialog } from "./bulk-add-dialog";
import { exportItemsCSV, exportItemsExcel } from "@/lib/utils/export";

// ────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────

async function fetchItems(): Promise<Item[]> {
  const response = await fetch("/api/inventory");
  if (!response.ok) throw new Error("Failed to load inventory");
  return response.json() as Promise<Item[]>;
}

async function deleteItem(id: string): Promise<void> {
  const response = await fetch(`/api/inventory/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete product");
}

async function bulkDeleteItems(ids: string[]): Promise<void> {
  const response = await fetch("/api/inventory/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) throw new Error("Failed to delete products");
}

async function bulkUpdateItems(
  payload: { id: string; data: Record<string, unknown> }[],
): Promise<{ succeeded: unknown[]; failed: { id: string; error: string }[] }> {
  const response = await fetch("/api/inventory/bulk", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update products");
  return response.json() as Promise<{
    succeeded: unknown[];
    failed: { id: string; error: string }[];
  }>;
}

// ────────────────────────────────────────────────────────────
// Loading skeleton
// ────────────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-8 px-2 sm:w-10 sm:px-4">
        <Skeleton className="size-4 rounded" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="size-8 rounded sm:size-10" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="h-4 w-24" />
      </TableCell>
      <TableCell className="hidden px-2 sm:table-cell sm:px-4">
        <Skeleton className="h-5 w-16" />
      </TableCell>
      <TableCell className="hidden px-2 text-right sm:table-cell sm:px-4">
        <Skeleton className="ml-auto h-4 w-14" />
      </TableCell>
      <TableCell className="px-2 text-right sm:px-4">
        <Skeleton className="ml-auto h-4 w-12" />
      </TableCell>
      <TableCell className="px-2 sm:px-4">
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell className="sticky right-0 bg-background px-2 sm:px-4">
        <Skeleton className="size-8" />
      </TableCell>
    </TableRow>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function InventoryTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [restockingItem, setRestockingItem] = useState<Item | null>(null);
  const [pricingItem, setPricingItem] = useState<Item | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewingImage, setViewingImage] = useState<Item | null>(null);

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery<Item[]>({
    queryKey: ["inventory"],
    queryFn: fetchItems,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setDeletingItem(null);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: bulkDeleteItems,
    onSuccess: (_data, ids) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedIds(new Set());
      toast.success(`${ids.length} product${ids.length > 1 ? "s" : ""} deleted`);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: bulkUpdateItems,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setSelectedIds(new Set());
      const count = result.succeeded.length;
      if (result.failed.length > 0) {
        toast.warning(
          `${count} product${count > 1 ? "s" : ""} updated, ${result.failed.length} failed`,
        );
      } else {
        toast.success(`${count} product${count > 1 ? "s" : ""} updated`);
      }
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Bulk update failed");
    },
  });

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const query = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.variety.toLowerCase().includes(query) ||
          (item.type?.toLowerCase().includes(query) ?? false)
        );
      }),
    [items, search],
  );

  const existingItems = useMemo(
    () => items.map((i) => ({ name: i.name, variety: i.variety })),
    [items],
  );

  const allVisibleSelected = useMemo(
    () => filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id)),
    [filteredItems, selectedIds],
  );

  const someVisibleSelected = useMemo(
    () => filteredItems.some((item) => selectedIds.has(item.id)) && !allVisibleSelected,
    [filteredItems, selectedIds, allVisibleSelected],
  );

  function handleFormSuccess() {
    void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    setIsCreateOpen(false);
    setEditingItem(null);
  }

  function handleConfirmDelete() {
    if (deletingItem) {
      deleteMutation.mutate(deletingItem.id);
    }
  }

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const visibleIds = filteredItems.map((item) => item.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(visibleIds);
    });
  }, [filteredItems]);

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

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  }

  function handleBulkEdit(data: Record<string, unknown>) {
    const ids = Array.from(selectedIds);
    const payload = ids.map((id) => ({ id, data }));
    bulkUpdateMutation.mutate(payload);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExportCSV={() => exportItemsCSV(items)}
            onExportExcel={() => exportItemsExcel(items)}
            disabled={items.length === 0}
          />
          <Button variant="outline" size="sm" onClick={() => setIsImportOpen(true)}>
            <Upload className="size-4" />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsBulkAddOpen(true)}>
            <PackagePlus className="size-4" />
            <span className="hidden sm:inline">Bulk Add</span>
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Product</span>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive dark:bg-destructive/20">
          {error instanceof Error ? error.message : "An error occurred while loading."}
        </div>
      )}

      {/* Bulk actions toolbar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        onDelete={handleBulkDelete}
        onBulkEdit={handleBulkEdit}
        onClear={() => setSelectedIds(new Set())}
        isDeleting={bulkDeleteMutation.isPending}
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2 sm:w-10 sm:px-4">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={toggleSelectAll}
                  className="size-4 cursor-pointer rounded border-input accent-primary"
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[40px] px-2 sm:w-[60px] sm:px-4">Image</TableHead>
              <TableHead className="px-2 sm:px-4">Name</TableHead>
              <TableHead className="hidden px-2 sm:table-cell sm:px-4">Type</TableHead>
              <TableHead className="hidden px-2 text-right sm:table-cell sm:px-4">Price</TableHead>
              <TableHead className="px-2 text-right sm:px-4">Qty</TableHead>
              <TableHead className="px-2 sm:px-4">Stock</TableHead>
              <TableHead className="sticky right-0 w-[48px] bg-background px-2 sm:w-[60px] sm:px-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)}

            {!isLoading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <Package className="size-10 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-muted-foreground">
                      {search ? "No products match your search." : "No products in inventory."}
                    </p>
                    {!search && (
                      <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
                        <Plus className="size-4" />
                        Add Product
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}

            <AnimatePresence>
              {!isLoading &&
                filteredItems.map((item, index) => (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.3, delay: index * 0.02 }}
                    className="cursor-pointer border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                    onClick={() => setEditingItem(item)}
                  >
                    {/* Checkbox */}
                    <TableCell
                      className="w-8 px-2 sm:w-10 sm:px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelectItem(item.id)}
                        className="size-4 cursor-pointer rounded border-input accent-primary"
                        aria-label={`Select ${item.name}`}
                      />
                    </TableCell>

                    {/* Thumbnail */}
                    <TableCell
                      className="px-2 sm:px-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (item.image_url) setViewingImage(item);
                      }}
                    >
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          width={40}
                          height={40}
                          className="size-8 cursor-zoom-in rounded object-cover sm:size-10"
                        />
                      ) : (
                        <div className="flex size-8 items-center justify-center rounded bg-muted sm:size-10 dark:bg-muted/50">
                          <Package className="size-4 text-muted-foreground sm:size-5" />
                        </div>
                      )}
                    </TableCell>

                    {/* Name + variety (variety shown below name on mobile) */}
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-sm font-medium sm:text-base">{item.name}</span>
                          {item.is_featured && (
                            <Badge variant="default" className="hidden text-[10px] sm:inline-flex">
                              FEATURED
                            </Badge>
                          )}
                          {item.badges?.map((badge: string) => (
                            <Badge
                              key={badge}
                              variant="secondary"
                              className={`hidden sm:inline-flex text-[10px] ${
                                badge === "PREMIUM"
                                  ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                                  : badge === "BESTSELLER"
                                    ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
                                    : badge === "LIMITED"
                                      ? "border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-400"
                                      : badge === "SEASONAL"
                                        ? "border-orange-500/50 bg-orange-500/10 text-orange-700 dark:text-orange-400"
                                        : badge === "PROMO"
                                          ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
                                          : "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              }`}
                            >
                              {badge}
                            </Badge>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{item.variety}</span>
                        {/* Price + Type shown only on mobile (hidden on sm+) */}
                        <span className="flex items-center gap-1 sm:hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            ${Number(item.price).toFixed(2)}
                          </span>
                          {item.type && (
                            <Badge variant="secondary" className="text-[10px]">
                              {item.type}
                            </Badge>
                          )}
                        </span>
                      </div>
                    </TableCell>

                    {/* Type — hidden on mobile, visible from sm */}
                    <TableCell className="hidden px-2 sm:table-cell sm:px-4">
                      {item.type ? (
                        <Badge variant="secondary">{item.type}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>

                    {/* Price — hidden on mobile, visible from sm */}
                    <TableCell className="hidden px-2 text-right tabular-nums sm:table-cell sm:px-4">
                      <span className="text-sm">${Number(item.price).toFixed(2)}</span>
                    </TableCell>

                    <TableCell className="px-2 text-right tabular-nums sm:px-4">
                      <span className="text-sm">{item.quantity}</span>
                      <span className="ml-0.5 hidden text-xs text-muted-foreground md:inline">
                        {item.unit_measure}
                      </span>
                    </TableCell>

                    <TableCell className="px-2 sm:px-4">
                      {(() => {
                        const availability = getAvailabilityStatus(
                          item.quantity,
                          item.low_stock_threshold,
                          null,
                        );
                        const badge = getAvailabilityBadgeConfig(availability);
                        return (
                          <Badge
                            variant="secondary"
                            className={`whitespace-nowrap text-[10px] sm:text-xs ${badge.className}`}
                          >
                            {badge.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>

                    <TableCell
                      className="sticky right-0 bg-background px-2 sm:px-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingItem(item)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRestockingItem(item)}>
                            <PackagePlus className="size-4" />
                            Restock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPricingItem(item)}>
                            <DollarSign className="size-4" />
                            Pricing
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <BulkAddDialog
        open={isBulkAddOpen}
        onOpenChange={setIsBulkAddOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["inventory"] });
        }}
      />

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Fill in the new product details.</DialogDescription>
          </DialogHeader>
          <InventoryForm onSuccess={handleFormSuccess} onCancel={() => setIsCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={editingItem !== null}
        onOpenChange={(open) => {
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update the product details.</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <InventoryForm
              item={editingItem}
              onSuccess={handleFormSuccess}
              onCancel={() => setEditingItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deletingItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{deletingItem?.name}</span> ({deletingItem?.variety})?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingItem(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing tiers editor */}
      <PricingTiersEditor
        item={pricingItem}
        open={pricingItem !== null}
        onOpenChange={(open) => {
          if (!open) setPricingItem(null);
        }}
      />

      {/* Restock dialog */}
      <RestockDialog
        item={restockingItem}
        open={restockingItem !== null}
        onOpenChange={(open) => {
          if (!open) setRestockingItem(null);
        }}
      />

      {/* Image viewer */}
      <Dialog
        open={viewingImage !== null}
        onOpenChange={(open) => {
          if (!open) setViewingImage(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewingImage?.name} &mdash; {viewingImage?.variety}
            </DialogTitle>
          </DialogHeader>
          {viewingImage?.image_url && (
            <div className="relative aspect-square w-full overflow-hidden rounded-lg">
              <Image
                src={viewingImage.image_url}
                alt={viewingImage.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 400px"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingImage(null)}>
              Close
            </Button>
            <Button
              onClick={() => {
                setEditingItem(viewingImage);
                setViewingImage(null);
              }}
            >
              <Pencil className="size-4" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <ImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        existingItems={existingItems}
      />
    </div>
  );
}
