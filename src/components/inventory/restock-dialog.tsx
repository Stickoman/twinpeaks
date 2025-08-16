"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PackagePlus } from "lucide-react";
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
import type { Item } from "@/types/database";

interface RestockDialogProps {
  item: Item | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function restockItem(id: string, quantity: number): Promise<void> {
  const response = await fetch(`/api/inventory/${id}/restock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error ?? "Failed to restock");
  }
}

export function RestockDialog({ item, open, onOpenChange }: RestockDialogProps) {
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState("");

  const mutation = useMutation({
    mutationFn: () => restockItem(item!.id, parseInt(quantity, 10)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      setQuantity("");
      onOpenChange(false);
    },
  });

  const parsedQty = parseInt(quantity, 10);
  const isValid = !isNaN(parsedQty) && parsedQty > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setQuantity("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="size-5" />
            Restock
          </DialogTitle>
          <DialogDescription>
            Add stock to <span className="font-semibold">{item?.name}</span> ({item?.variety}).
            Current stock: {item?.quantity} {item?.unit_measure}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="restock-qty">Quantity to add</Label>
          <Input
            id="restock-qty"
            type="number"
            min={1}
            placeholder="Enter quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </div>

        {mutation.isError && (
          <p className="text-sm text-destructive">
            {mutation.error instanceof Error ? mutation.error.message : "Restock failed"}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
            {mutation.isPending ? "Restocking..." : "Restock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
