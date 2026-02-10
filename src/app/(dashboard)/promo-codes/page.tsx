"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  Ticket,
  MoreHorizontal,
  Trash2,
  Ban,
  Calendar,
  Percent,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

import type { PromoCode } from "@/types/database";
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

async function fetchPromoCodes(): Promise<PromoCode[]> {
  const res = await fetch("/api/promo-codes");
  if (!res.ok) throw new Error("Failed to load promo codes");
  return res.json() as Promise<PromoCode[]>;
}

async function createPromoCode(data: {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_uses: number | null;
  valid_until: string | null;
}): Promise<PromoCode> {
  const res = await fetch("/api/promo-codes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to create promo code");
  }
  return res.json() as Promise<PromoCode>;
}

async function deletePromoCode(id: string): Promise<void> {
  const res = await fetch(`/api/promo-codes/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to deactivate promo code");
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatDiscount(type: "percentage" | "fixed", value: number): string {
  return type === "percentage" ? `${value}%` : `$${value.toFixed(2)} off`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ────────────────────────────────────────────────────────────
// Form defaults
// ────────────────────────────────────────────────────────────

interface PromoFormState {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_uses: string;
  valid_until: string;
}

const DEFAULT_FORM: PromoFormState = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "0",
  max_uses: "",
  valid_until: "",
};

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default function PromoCodesPage() {
  const queryClient = useQueryClient();

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);

  // Form state
  const [form, setForm] = useState<PromoFormState>(DEFAULT_FORM);

  const { data: promoCodes = [], isLoading } = useQuery({
    queryKey: ["promo-codes"],
    queryFn: fetchPromoCodes,
  });

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: createPromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      toast.success("Promo code created");
      setShowCreate(false);
      resetForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      setDeleteTarget(null);
      toast.success("Promo code deactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setForm(DEFAULT_FORM);
  }

  function handleCreate() {
    const discountValue = parseFloat(form.discount_value);
    const minOrder = parseFloat(form.min_order_amount) || 0;
    const maxUses = form.max_uses ? parseInt(form.max_uses, 10) : null;
    const validUntil = form.valid_until
      ? new Date(form.valid_until + "T23:59:59Z").toISOString()
      : null;

    if (!form.code.trim() || isNaN(discountValue) || discountValue <= 0) return;

    createMutation.mutate({
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: discountValue,
      min_order_amount: minOrder,
      max_uses: maxUses,
      valid_until: validUntil,
    });
  }

  function openCreate() {
    resetForm();
    setShowCreate(true);
  }

  function updateField<K extends keyof PromoFormState>(key: K, value: PromoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isFormValid =
    form.code.trim().length >= 3 &&
    !isNaN(parseFloat(form.discount_value)) &&
    parseFloat(form.discount_value) > 0;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Promo Codes</h1>
          <p className="text-sm text-muted-foreground">Create and manage discount codes</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Code
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : promoCodes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Ticket className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No promo codes yet</p>
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="size-4" />
              Add First Code
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
          {promoCodes.map((promo) => (
            <motion.div key={promo.id} variants={fadeUpItem}>
              <Card>
                <CardContent className="flex items-start justify-between py-4">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-mono text-lg font-bold">{promo.code}</p>
                      <Badge
                        variant="default"
                        className={
                          promo.is_active
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/50 dark:text-zinc-400"
                        }
                      >
                        {promo.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-sm">
                      {promo.discount_type === "percentage" ? (
                        <Percent className="size-3.5 text-muted-foreground" />
                      ) : (
                        <DollarSign className="size-3.5 text-muted-foreground" />
                      )}
                      <span className="font-medium">
                        {formatDiscount(promo.discount_type, promo.discount_value)}
                      </span>
                      {promo.min_order_amount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          (min ${promo.min_order_amount.toFixed(2)})
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {promo.current_uses}/{promo.max_uses ?? "\u221E"} uses
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {formatDate(promo.valid_from)}
                        {promo.valid_until && <span>&ndash; {formatDate(promo.valid_until)}</span>}
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
                      {promo.is_active && (
                        <DropdownMenuItem onClick={() => setDeleteTarget(promo)}>
                          <Ban className="size-4" />
                          Deactivate
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteTarget(promo)}
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

      {/* Create Promo Code Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowCreate(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Promo Code</DialogTitle>
            <DialogDescription>Create a new discount code for customers.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                placeholder="e.g. SUMMER20"
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">
                Letters, numbers, hyphens, and underscores only.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Discount Type *</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(v) => updateField("discount_type", v as "percentage" | "fixed")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Discount Value *</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={form.discount_value}
                  onChange={(e) => updateField("discount_value", e.target.value)}
                  placeholder={form.discount_type === "percentage" ? "e.g. 20" : "e.g. 10.00"}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min Order Amount ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.min_order_amount}
                  onChange={(e) => updateField("min_order_amount", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={form.max_uses}
                  onChange={(e) => updateField("max_uses", e.target.value)}
                  placeholder="Unlimited"
                />
                <p className="text-xs text-muted-foreground">Leave empty for unlimited.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => updateField("valid_until", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave empty for no expiration date.</p>
            </div>
          </div>

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
            <Button onClick={handleCreate} disabled={!isFormValid || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Deactivate confirmation */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Promo Code</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{" "}
              <span className="font-mono font-semibold">{deleteTarget?.code}</span>? The code will
              no longer be usable by customers.
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
              {deleteMutation.isPending ? "Deactivating..." : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
