"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import type { Category } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface BulkActionsToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onBulkEdit: (data: Record<string, unknown>) => void;
  onClear: () => void;
  isDeleting: boolean;
}

const BADGE_OPTIONS = ["HOT", "PROMO", "NEW"] as const;

// ────────────────────────────────────────────────────────────
// API helper
// ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function BulkActionsToolbar({
  selectedCount,
  onDelete,
  onBulkEdit,
  onClear,
  isDeleting,
}: BulkActionsToolbarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Edit form state
  const [editCategoryId, setEditCategoryId] = useState<string | undefined>(undefined);
  const [editPrice, setEditPrice] = useState<string>("");
  const [editBadges, setEditBadges] = useState<string[]>([]);
  const [badgesTouched, setBadgesTouched] = useState(false);
  const [editFeatured, setEditFeatured] = useState<boolean | undefined>(undefined);

  // Fetch categories only when the edit dialog is open
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    enabled: showEditDialog,
  });

  function resetEditForm() {
    setEditCategoryId(undefined);
    setEditPrice("");
    setEditBadges([]);
    setBadgesTouched(false);
    setEditFeatured(undefined);
  }

  const hasChanges =
    editCategoryId !== undefined || editPrice !== "" || badgesTouched || editFeatured !== undefined;

  function handleApplyEdit() {
    const data: Record<string, unknown> = {};

    if (editCategoryId !== undefined) {
      data.category_id = editCategoryId;
      // Also set the name from the selected category
      const cat = categories.find((c) => c.id === editCategoryId);
      if (cat) data.name = cat.name;
    }

    if (editPrice !== "") {
      const parsed = parseFloat(editPrice);
      if (!isNaN(parsed) && parsed >= 0) {
        data.price = parsed;
      }
    }

    if (badgesTouched) {
      data.badges = editBadges;
    }

    if (editFeatured !== undefined) {
      data.is_featured = editFeatured;
    }

    onBulkEdit(data);
    setShowEditDialog(false);
  }

  function toggleBadge(badge: string) {
    setBadgesTouched(true);
    setEditBadges((prev) =>
      prev.includes(badge) ? prev.filter((b) => b !== badge) : [...prev, badge],
    );
  }

  if (selectedCount === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 left-4 right-4 z-50 sm:left-1/2 sm:right-auto sm:-translate-x-1/2"
        >
          <div className="flex w-full items-center justify-between gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur sm:w-auto sm:justify-start">
            <Badge variant="secondary" className="shrink-0">
              {selectedCount} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDialog(true)}
              className="flex-1 sm:flex-none"
            >
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={isDeleting}
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={onClear} className="shrink-0">
              <X className="size-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} items?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedCount} selected items and their images. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowConfirm(false);
                onDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk edit dialog */}
      <Dialog
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) resetEditForm();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {selectedCount} items</DialogTitle>
            <DialogDescription>
              Only filled fields will be updated. Leave fields empty to keep current values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              {categoriesLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={editCategoryId ?? ""}
                  onValueChange={(value) => setEditCategoryId(value || undefined)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Unchanged" />
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

            {/* Price */}
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="Unchanged"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
              />
            </div>

            {/* Badges */}
            <div className="space-y-2">
              <Label>Badges</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_OPTIONS.map((badge) => {
                  const isSelected = editBadges.includes(badge);
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
              {!badgesTouched && (
                <p className="text-xs text-muted-foreground">
                  Click a badge to change. Unchanged by default.
                </p>
              )}
              {badgesTouched && editBadges.length === 0 && (
                <p className="text-xs text-muted-foreground">All badges will be removed.</p>
              )}
            </div>

            {/* Featured toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Featured Product</Label>
                <p className="text-xs text-muted-foreground">
                  {editFeatured === undefined
                    ? "Unchanged"
                    : editFeatured
                      ? "Will be featured"
                      : "Will not be featured"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {editFeatured !== undefined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => setEditFeatured(undefined)}
                  >
                    Reset
                  </Button>
                )}
                <Switch
                  checked={editFeatured ?? false}
                  onCheckedChange={(checked) => setEditFeatured(checked)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyEdit} disabled={!hasChanges}>
              Apply to {selectedCount} items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
