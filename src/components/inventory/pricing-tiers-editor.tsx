"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Sparkles, Trash2, Plus } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import type { Item } from "@/types/database";

interface PricingTier {
  unit: string;
  price: number;
  min_quantity: number;
  max_quantity: number | null;
  sort_order: number;
}

interface PricingTiersEditorProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchTiers(itemId: string): Promise<PricingTier[]> {
  const res = await fetch(`/api/inventory/${itemId}/pricing`);
  if (!res.ok) throw new Error("Failed to load pricing tiers");
  return res.json() as Promise<PricingTier[]>;
}

async function saveTiers(itemId: string, tiers: PricingTier[]): Promise<void> {
  const res = await fetch(`/api/inventory/${itemId}/pricing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tiers }),
  });
  if (!res.ok) throw new Error("Failed to save pricing tiers");
}

async function generateTiers(
  itemId: string,
  basePrice: number,
  baseUnit: string,
): Promise<PricingTier[]> {
  const res = await fetch(`/api/inventory/${itemId}/pricing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_price: basePrice, base_unit: baseUnit }),
  });
  if (!res.ok) throw new Error("Failed to generate pricing tiers");
  const data = (await res.json()) as { tiers: PricingTier[] };
  return data.tiers;
}

export function PricingTiersEditor({ item, open, onOpenChange }: PricingTiersEditorProps) {
  const queryClient = useQueryClient();
  const [localTiers, setLocalTiers] = useState<PricingTier[] | null>(null);
  const [basePrice, setBasePrice] = useState("");
  const [baseUnit, setBaseUnit] = useState("pound");

  const isCountItem = item
    ? ["unit", "box", "pack", "tab", "piece"].includes(item.unit_measure)
    : false;
  const unitOptions = isCountItem ? COUNT_UNITS : WEIGHT_UNITS;
  const effectiveBaseUnit = unitOptions.some((u) => u.value === baseUnit)
    ? baseUnit
    : unitOptions[0].value;

  const { data: fetchedTiers, isLoading } = useQuery({
    queryKey: ["pricing-tiers", item?.id],
    queryFn: () => fetchTiers(item!.id),
    enabled: !!item && open,
  });

  // Local edits take priority; otherwise show server data
  const tiers = localTiers ?? fetchedTiers ?? [];

  function setTiers(value: PricingTier[] | ((prev: PricingTier[]) => PricingTier[])) {
    if (typeof value === "function") {
      setLocalTiers((prev) => value(prev ?? fetchedTiers ?? []));
    } else {
      setLocalTiers(value);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () => saveTiers(item!.id, tiers),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["pricing-tiers", item?.id] });
      onOpenChange(false);
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateTiers(item!.id, parseFloat(basePrice), effectiveBaseUnit),
    onSuccess: (data) => {
      setTiers(data);
      void queryClient.invalidateQueries({ queryKey: ["pricing-tiers", item?.id] });
    },
  });

  function addTier() {
    const defaultUnit = unitOptions[0]?.value ?? "g";
    setTiers((prev) => [
      ...prev,
      { unit: defaultUnit, price: 0, min_quantity: 1, max_quantity: null, sort_order: prev.length },
    ]);
  }

  function removeTier(index: number) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function updateTier(index: number, field: keyof PricingTier, value: string | number | null) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setLocalTiers(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            Pricing Tiers
          </DialogTitle>
          <DialogDescription>
            Set tiered pricing for <span className="font-semibold">{item?.name}</span> (
            {item?.variety}). Base price: ${Number(item?.price ?? 0).toFixed(2)}.
          </DialogDescription>
        </DialogHeader>

        {/* Auto-generate section */}
        <div className="flex items-end gap-2 rounded-lg border p-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Base Price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              placeholder="700.00"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
            />
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-xs">Base Unit</Label>
            <Select value={effectiveBaseUnit} onValueChange={setBaseUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {unitOptions.map((u) => (
                  <SelectItem key={u.value} value={u.value}>
                    {u.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!basePrice || parseFloat(basePrice) <= 0 || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <Sparkles className="size-4" />
            {generateMutation.isPending ? "Generating..." : "Auto-generate"}
          </Button>
        </div>

        {/* Tiers table */}
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading tiers...</div>
        ) : (
          <div className="max-h-64 overflow-x-auto overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Price ($)</TableHead>
                  <TableHead>Min Qty</TableHead>
                  <TableHead>Max Qty</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No pricing tiers. Add one or auto-generate.
                    </TableCell>
                  </TableRow>
                )}
                {tiers.map((tier, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select
                        value={tier.unit}
                        onValueChange={(val) => updateTier(index, "unit", val)}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {unitOptions.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-8 w-24"
                        value={tier.price}
                        onChange={(e) =>
                          updateTier(index, "price", parseFloat(e.target.value) || 0)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16"
                        value={tier.min_quantity}
                        onChange={(e) =>
                          updateTier(index, "min_quantity", parseInt(e.target.value, 10) || 1)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        className="h-8 w-16"
                        placeholder="-"
                        value={tier.max_quantity ?? ""}
                        onChange={(e) =>
                          updateTier(
                            index,
                            "max_quantity",
                            e.target.value ? parseInt(e.target.value, 10) : null,
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" onClick={() => removeTier(index)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Button variant="outline" size="sm" onClick={addTier}>
          <Plus className="size-4" />
          Add Tier
        </Button>

        {(saveMutation.isError || generateMutation.isError) && (
          <p className="text-sm text-destructive">
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : generateMutation.error instanceof Error
                ? generateMutation.error.message
                : "An error occurred"}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : "Save Tiers"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
