"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Tags, MoreHorizontal, Trash2, Pencil, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import type { Category } from "@/types/database";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

async function createCategory(data: {
  name: string;
  slug: string;
  icon: string;
  grade_visibility: "classic" | "premium";
  unit_type: "weight" | "count" | "volume";
  sort_order: number;
  low_stock_threshold: number;
}): Promise<Category> {
  const res = await fetch("/api/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to create category");
  }
  return res.json() as Promise<Category>;
}

async function updateCategory(id: string, data: Record<string, unknown>): Promise<Category> {
  const res = await fetch(`/api/categories/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to update category");
  }
  return res.json() as Promise<Category>;
}

async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete category");
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const GRADE_COLORS: Record<string, string> = {
  classic: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  premium: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

const UNIT_LABELS: Record<string, string> = {
  weight: "Weight",
  count: "Count",
  volume: "Volume",
};

// ────────────────────────────────────────────────────────────
// Form defaults
// ────────────────────────────────────────────────────────────

interface CategoryFormState {
  name: string;
  slug: string;
  icon: string;
  grade_visibility: "classic" | "premium";
  unit_type: "weight" | "count" | "volume";
  sort_order: number;
  low_stock_threshold: number;
}

const DEFAULT_FORM: CategoryFormState = {
  name: "",
  slug: "",
  icon: "\u{1F4E6}",
  grade_visibility: "classic",
  unit_type: "weight",
  sort_order: 0,
  low_stock_threshold: 10,
};

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);

  // Form state
  const [form, setForm] = useState<CategoryFormState>(DEFAULT_FORM);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  function openEdit(cat: Category) {
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon,
      grade_visibility: cat.grade_visibility,
      unit_type: cat.unit_type,
      sort_order: cat.sort_order,
      low_stock_threshold: cat.low_stock_threshold,
    });
    setSlugManuallyEdited(true);
    setEditTarget(cat);
  }

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created");
      setShowCreate(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated");
      setEditTarget(null);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setDeleteTarget(null);
      toast.success("Category deactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setForm(DEFAULT_FORM);
    setSlugManuallyEdited(false);
  }

  function handleCreate() {
    createMutation.mutate({ ...form });
  }

  function handleUpdate() {
    if (!editTarget) return;
    updateMutation.mutate({ id: editTarget.id, data: { ...form } });
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function updateField<K extends keyof CategoryFormState>(key: K, value: CategoryFormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "name" && !slugManuallyEdited && !editTarget) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }

  // ── Shared form fields ────────────────────────────────────

  function renderFormFields(mode: "create" | "edit") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="e.g. Flowers"
          />
        </div>

        <div className="space-y-2">
          <Label>Slug *</Label>
          <Input
            value={form.slug}
            onChange={(e) => {
              updateField("slug", e.target.value);
              if (mode === "create") setSlugManuallyEdited(true);
            }}
            placeholder="e.g. flowers"
          />
          {mode === "create" && (
            <p className="text-xs text-muted-foreground">
              Auto-generated from name. Edit to customize.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Icon</Label>
          <Input
            value={form.icon}
            onChange={(e) => updateField("icon", e.target.value)}
            placeholder="\u{1F4E6}"
            className="w-20"
          />
        </div>

        <div className="space-y-2">
          <Label>Grade Visibility</Label>
          <Select
            value={form.grade_visibility}
            onValueChange={(v) => updateField("grade_visibility", v as "classic" | "premium")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Unit Type</Label>
          <Select
            value={form.unit_type}
            onValueChange={(v) => updateField("unit_type", v as "weight" | "count" | "volume")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weight">Weight</SelectItem>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Sort Order</Label>
            <Input
              type="number"
              min={0}
              value={form.sort_order}
              onChange={(e) => updateField("sort_order", parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label>Low Stock Threshold</Label>
            <Input
              type="number"
              min={0}
              value={form.low_stock_threshold}
              onChange={(e) =>
                updateField("low_stock_threshold", parseInt(e.target.value, 10) || 0)
              }
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Manage product categories</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Tags className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No categories yet</p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add First Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <motion.div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {categories.map((category) => (
            <motion.div key={category.id} variants={fadeUpItem}>
              <Card>
                <CardContent className="flex items-start justify-between py-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{category.icon}</span>
                      <p className="truncate font-medium">{category.name}</p>
                      <Badge
                        variant="default"
                        className={GRADE_COLORS[category.grade_visibility] ?? ""}
                      >
                        {category.grade_visibility}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{category.slug}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {UNIT_LABELS[category.unit_type] ?? category.unit_type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ArrowUpDown className="size-3" />
                        {category.sort_order}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(category)}>
                        <Pencil className="size-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(category)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Category Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowCreate(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Create a new product category.</DialogDescription>
          </DialogHeader>
          {renderFormFields("create")}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!form.name || !form.slug || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Update category details for <span className="font-semibold">{editTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          {renderFormFields("edit")}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditTarget(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!form.name || !form.slug || updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-semibold">{deleteTarget?.name}</span>? The category will be
              hidden but existing references will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
