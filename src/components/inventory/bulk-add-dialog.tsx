"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import type { Category } from "@/types/database";
import { WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

const BADGE_OPTIONS = ["HOT", "PROMO", "NEW"] as const;
type Badge = (typeof BADGE_OPTIONS)[number];

interface BulkItemRow {
  id: string;
  variety: string;
  quantity: number | "";
  price: number | "";
}

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function createEmptyRow(): BulkItemRow {
  return {
    id: crypto.randomUUID(),
    variety: "",
    quantity: "",
    price: "",
  };
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

interface BulkCreatePayload {
  category_id: string;
  unit_measure: string;
  badges: Badge[];
  items: { name: string; variety: string; quantity: number; price: number }[];
}

async function bulkCreateItems(payload: BulkCreatePayload) {
  const res = await fetch("/api/inventory/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to create items");
  }
  return res.json();
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function BulkAddDialog({ open, onOpenChange, onSuccess }: BulkAddDialogProps) {
  // Shared fields
  const [categoryId, setCategoryId] = useState<string>("");
  const [unitMeasure, setUnitMeasure] = useState<string>("g");
  const [badges, setBadges] = useState<Badge[]>([]);

  // Item rows
  const [rows, setRows] = useState<BulkItemRow[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  // Categories query
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  // Derive unit options from selected category
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const unitType = selectedCategory?.unit_type ?? "weight";
  const availableUnits = unitType === "count" ? COUNT_UNITS : WEIGHT_UNITS;

  // Mutation
  const mutation = useMutation({
    mutationFn: bulkCreateItems,
    onSuccess: () => {
      toast.success(`${rows.filter((r) => r.variety.trim()).length} items created`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Row management ─────────────────────────────────────

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof Omit<BulkItemRow, "id">, value: string | number) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    [],
  );

  // ── Category change ────────────────────────────────────

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    const cat = categories.find((c) => c.id === newCategoryId);
    if (cat) {
      const defaultUnit = cat.unit_type === "count" ? "unit" : "g";
      setUnitMeasure(defaultUnit);
    }
  }

  // ── Badge toggle ───────────────────────────────────────

  function toggleBadge(badge: Badge) {
    setBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  }

  // ── Reset ──────────────────────────────────────────────

  function resetForm() {
    setCategoryId("");
    setUnitMeasure("g");
    setBadges([]);
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  }

  // ── Validation & Submit ────────────────────────────────

  function handleSubmit() {
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    const categoryName = selectedCategory?.name ?? "";

    const validRows = rows.filter((r) => r.variety.trim() !== "");
    if (validRows.length === 0) {
      toast.error("Add at least one item with a variety name");
      return;
    }

    const hasInvalid = validRows.some(
      (r) => r.quantity === "" || Number(r.quantity) < 0 || r.price === "" || Number(r.price) < 0,
    );
    if (hasInvalid) {
      toast.error("All items must have valid quantity and price");
      return;
    }

    mutation.mutate({
      category_id: categoryId,
      unit_measure: unitMeasure,
      badges,
      items: validRows.map((r) => ({
        name: categoryName,
        variety: r.variety.trim(),
        quantity: Number(r.quantity),
        price: Number(r.price),
      })),
    });
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Multiple Items</DialogTitle>
          <DialogDescription>
            Set shared fields once, then add each item as a row below.
          </DialogDescription>
        </DialogHeader>

        {/* ── Shared Fields ──────────────────────────────── */}
        <div className="space-y-4 border-b pb-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            {categoriesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Unit Measure */}
          <div className="space-y-2">
            <Label>Unit Measure</Label>
            <Select value={unitMeasure} onValueChange={setUnitMeasure}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Badges */}
          <div className="space-y-2">
            <Label>Badges</Label>
            <div className="flex flex-wrap gap-2">
              {BADGE_OPTIONS.map((badge) => {
                const isSelected = badges.includes(badge);
                return (
                  <Button
                    key={badge}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => toggleBadge(badge)}
                  >
                    {badge}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Item Rows ──────────────────────────────────── */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Items</Label>

          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_80px_80px_36px] sm:items-end sm:gap-3"
            >
              {/* Variety */}
              <div className="space-y-1">
                {index === 0 && <Label className="text-xs text-muted-foreground">Variety *</Label>}
                <Input
                  placeholder="e.g. OG Kush"
                  value={row.variety}
                  onChange={(e) => updateRow(row.id, "variety", e.target.value)}
                />
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <div className="space-y-1">
                  {index === 0 && <Label className="text-xs text-muted-foreground">Qty *</Label>}
                  <Input
                    type="number"
                    min={0}
                    step={unitType === "count" ? "1" : "any"}
                    placeholder="0"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        "quantity",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>

                {/* Price */}
                <div className="space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Price ($)</Label>
                  )}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={row.price}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        "price",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>
              </div>

              {/* Remove */}
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove row</span>
                </Button>
              </div>
            </div>
          ))}

          {/* Add Row */}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>

        {/* ── Mutation error ─────────────────────────────── */}
        {mutation.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
            {mutation.error instanceof Error ? mutation.error.message : "An error occurred."}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending
              ? "Creating..."
              : `Create ${rows.filter((r) => r.variety.trim()).length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import type { Category } from "@/types/database";
import { WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

const BADGE_OPTIONS = ["HOT", "PROMO", "NEW"] as const;
type Badge = (typeof BADGE_OPTIONS)[number];

interface BulkItemRow {
  id: string;
  variety: string;
  quantity: number | "";
  price: number | "";
}

interface BulkAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function createEmptyRow(): BulkItemRow {
  return {
    id: crypto.randomUUID(),
    variety: "",
    quantity: "",
    price: "",
  };
}

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

interface BulkCreatePayload {
  category_id: string;
  unit_measure: string;
  badges: Badge[];
  items: { name: string; variety: string; quantity: number; price: number }[];
}

async function bulkCreateItems(payload: BulkCreatePayload) {
  const res = await fetch("/api/inventory/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "Failed to create items");
  }
  return res.json();
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function BulkAddDialog({ open, onOpenChange, onSuccess }: BulkAddDialogProps) {
  // Shared fields
  const [categoryId, setCategoryId] = useState<string>("");
  const [unitMeasure, setUnitMeasure] = useState<string>("g");
  const [badges, setBadges] = useState<Badge[]>([]);

  // Item rows
  const [rows, setRows] = useState<BulkItemRow[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ]);

  // Categories query
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  // Derive unit options from selected category
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const unitType = selectedCategory?.unit_type ?? "weight";
  const availableUnits = unitType === "count" ? COUNT_UNITS : WEIGHT_UNITS;

  // Mutation
  const mutation = useMutation({
    mutationFn: bulkCreateItems,
    onSuccess: () => {
      toast.success(`${rows.filter((r) => r.variety.trim()).length} items created`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // ── Row management ─────────────────────────────────────

  const addRow = useCallback(() => {
    setRows((prev) => [...prev, createEmptyRow()]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof Omit<BulkItemRow, "id">, value: string | number) => {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
    },
    [],
  );

  // ── Category change ────────────────────────────────────

  function handleCategoryChange(newCategoryId: string) {
    setCategoryId(newCategoryId);
    const cat = categories.find((c) => c.id === newCategoryId);
    if (cat) {
      const defaultUnit = cat.unit_type === "count" ? "unit" : "g";
      setUnitMeasure(defaultUnit);
    }
  }

  // ── Badge toggle ───────────────────────────────────────

  function toggleBadge(badge: Badge) {
    setBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  }

  // ── Reset ──────────────────────────────────────────────

  function resetForm() {
    setCategoryId("");
    setUnitMeasure("g");
    setBadges([]);
    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()]);
  }

  // ── Validation & Submit ────────────────────────────────

  function handleSubmit() {
    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    const categoryName = selectedCategory?.name ?? "";

    const validRows = rows.filter((r) => r.variety.trim() !== "");
    if (validRows.length === 0) {
      toast.error("Add at least one item with a variety name");
      return;
    }

    const hasInvalid = validRows.some(
      (r) => r.quantity === "" || Number(r.quantity) < 0 || r.price === "" || Number(r.price) < 0,
    );
    if (hasInvalid) {
      toast.error("All items must have valid quantity and price");
      return;
    }

    mutation.mutate({
      category_id: categoryId,
      unit_measure: unitMeasure,
      badges,
      items: validRows.map((r) => ({
        name: categoryName,
        variety: r.variety.trim(),
        quantity: Number(r.quantity),
        price: Number(r.price),
      })),
    });
  }

  // ── Render ─────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Multiple Items</DialogTitle>
          <DialogDescription>
            Set shared fields once, then add each item as a row below.
          </DialogDescription>
        </DialogHeader>

        {/* ── Shared Fields ──────────────────────────────── */}
        <div className="space-y-4 border-b pb-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            {categoriesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Unit Measure */}
          <div className="space-y-2">
            <Label>Unit Measure</Label>
            <Select value={unitMeasure} onValueChange={setUnitMeasure}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                {availableUnits.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Badges */}
          <div className="space-y-2">
            <Label>Badges</Label>
            <div className="flex flex-wrap gap-2">
              {BADGE_OPTIONS.map((badge) => {
                const isSelected = badges.includes(badge);
                return (
                  <Button
                    key={badge}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => toggleBadge(badge)}
                  >
                    {badge}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Item Rows ──────────────────────────────────── */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Items</Label>

          {rows.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_80px_80px_36px] sm:items-end sm:gap-3"
            >
              {/* Variety */}
              <div className="space-y-1">
                {index === 0 && <Label className="text-xs text-muted-foreground">Variety *</Label>}
                <Input
                  placeholder="e.g. OG Kush"
                  value={row.variety}
                  onChange={(e) => updateRow(row.id, "variety", e.target.value)}
                />
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-2 sm:contents">
                <div className="space-y-1">
                  {index === 0 && <Label className="text-xs text-muted-foreground">Qty *</Label>}
                  <Input
                    type="number"
                    min={0}
                    step={unitType === "count" ? "1" : "any"}
                    placeholder="0"
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        "quantity",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>

                {/* Price */}
                <div className="space-y-1">
                  {index === 0 && (
                    <Label className="text-xs text-muted-foreground">Price ($)</Label>
                  )}
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={row.price}
                    onChange={(e) =>
                      updateRow(
                        row.id,
                        "price",
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </div>
              </div>

              {/* Remove */}
              <div className="flex items-end justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length <= 1}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove row</span>
                </Button>
              </div>
            </div>
          ))}

          {/* Add Row */}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addRow}>
            <Plus className="mr-2 h-4 w-4" />
            Add Row
          </Button>
        </div>

        {/* ── Mutation error ─────────────────────────────── */}
        {mutation.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
            {mutation.error instanceof Error ? mutation.error.message : "An error occurred."}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────── */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={mutation.isPending}>
            {mutation.isPending
              ? "Creating..."
              : `Create ${rows.filter((r) => r.variety.trim()).length} Items`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
