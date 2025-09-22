"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import type { OrderStatus } from "@/types/database";

const ALL_STATUSES: OrderStatus[] = ["pending", "assigned", "en_route", "delivered", "cancelled"];

interface OrdersBulkToolbarProps {
  selectedCount: number;
  onStatusChange: (status: OrderStatus) => void;
  onDelete: () => void;
  onClear: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function OrdersBulkToolbar({
  selectedCount,
  onStatusChange,
  onDelete,
  onClear,
  isUpdating,
  isDeleting,
}: OrdersBulkToolbarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
      <AnimatePresence>
        {selectedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          >
            <div className="flex items-center gap-3 rounded-full border bg-background/95 px-5 py-2.5 shadow-lg backdrop-blur">
              <Badge variant="secondary" className="tabular-nums">
                {selectedCount} selected
              </Badge>

              <Select
                onValueChange={(value: string) => onStatusChange(value as OrderStatus)}
                disabled={isUpdating}
              >
                <SelectTrigger className="h-8 w-[150px] rounded-full text-xs">
                  <RefreshCw className="size-3.5" />
                  <SelectValue placeholder="Change status" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((s) => {
                    const config = ORDER_STATUS_CONFIG[s];
                    const Icon = config.icon;
                    return (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-1.5">
                          <Icon className="size-3.5" />
                          {config.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                size="sm"
                className="rounded-full"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting}
              >
                <Trash2 className="size-4" />
                Delete
              </Button>

              <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={onClear}>
                <X className="size-4" />
                <span className="sr-only">Clear selection</span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {selectedCount} order{selectedCount > 1 ? "s" : ""}?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedCount} selected order
              {selectedCount > 1 ? "s" : ""}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
