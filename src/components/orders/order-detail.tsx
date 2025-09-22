"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, MapPin, StickyNote, X } from "lucide-react";
import { toast } from "sonner";

import { ORDER_STATUSES } from "@/lib/utils/constants";
import { formatDate } from "@/lib/utils/helpers";
import { ORDER_STATUS_CONFIG } from "@/lib/utils/order-status";
import type { Order, OrderStatus, OrderWithItems } from "@/types/database";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AssignDriverDialog } from "./assign-driver-dialog";
import { DeliveryProofView } from "./delivery-proof-view";
import { DeliveryRouteView } from "./delivery-route-view";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface OrderDetailProps {
  order: OrderWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
  onDelete: (orderId: string) => void;
}

// ────────────────────────────────────────────────────────────
// Status config
// ────────────────────────────────────────────────────────────

const STATUS_TIMELINE_ORDER: OrderStatus[] = ["pending", "assigned", "en_route", "delivered"];

function getStatusStep(status: OrderStatus): number {
  if (status === "cancelled") return -1;
  return STATUS_TIMELINE_ORDER.indexOf(status);
}

// ────────────────────────────────────────────────────────────
// Note mutation helper
// ────────────────────────────────────────────────────────────

async function addOrderNote(orderId: string, notes: string): Promise<Order> {
  const res = await fetch(`/api/orders/${orderId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error("Failed to add note");
  return res.json();
}

// ────────────────────────────────────────────────────────────
// Status Timeline
// ────────────────────────────────────────────────────────────

function StatusTimeline({ status }: { status: OrderStatus }) {
  const currentStep = getStatusStep(status);
  const isCancelled = status === "cancelled";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Progress</p>
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex w-max items-center gap-2">
          {STATUS_TIMELINE_ORDER.map((s, index) => {
            const config = ORDER_STATUS_CONFIG[s];
            const Icon = config.icon;
            const isActive = !isCancelled && index <= currentStep;
            const isCurrentStep = !isCancelled && index === currentStep;

            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isCurrentStep
                      ? config.badgeClass
                      : isActive
                        ? "bg-muted text-foreground"
                        : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {config.label}
                </div>
                {index < STATUS_TIMELINE_ORDER.length - 1 && (
                  <div
                    className={`h-px w-6 ${
                      !isCancelled && index < currentStep ? "bg-foreground" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      {isCancelled && (
        <div className="mt-2 flex items-center gap-1.5">
          <Badge className={ORDER_STATUS_CONFIG.cancelled.badgeClass} variant="secondary">
            <X className="size-3" />
            Cancelled
          </Badge>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function OrderDetail({
  order,
  open,
  onOpenChange,
  onStatusChange,
  onDelete,
}: OrderDetailProps) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const noteMutation = useMutation({
    mutationFn: ({ orderId, notes }: { orderId: string; notes: string }) =>
      addOrderNote(orderId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setNoteText("");
      toast.success("Note added");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (!order) return null;

  const config = ORDER_STATUS_CONFIG[order.status];
  const StatusIcon = config.icon;

  function handleAddNote() {
    if (!order || !noteText.trim()) return;

    const existingNotes = order.notes ?? "";
    const separator = existingNotes ? "\n---\n" : "";
    const timestamp = new Date().toLocaleString("en-US");
    const updatedNotes = `${existingNotes}${separator}[${timestamp}] ${noteText.trim()}`;

    noteMutation.mutate({ orderId: order.id, notes: updatedNotes });
  }

  return (
    <>
      <Dialog open={open && !showDeleteConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <DialogTitle className="font-mono">Order #{order.id.slice(0, 8)}</DialogTitle>
              <Badge className={config.badgeClass} variant="secondary">
                <StatusIcon className="size-3" />
                {config.label}
              </Badge>
            </div>
            <DialogDescription className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {order.address}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto py-1">
            {/* Metadata */}
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline">{order.grade === "premium" ? "Premium" : "Classic"}</Badge>
              <span className="text-muted-foreground">Created {formatDate(order.created_at)}</span>
              {order.updated_at !== order.created_at && (
                <span className="text-muted-foreground">
                  Updated {formatDate(order.updated_at)}
                </span>
              )}
            </div>

            <Separator />

            <StatusTimeline status={order.status} />

            <Separator />

            {/* Delivery code */}
            {order.delivery_code && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Delivery Code:</span>
                <Badge variant="outline" className="font-mono text-base tracking-widest">
                  {order.delivery_code}
                </Badge>
              </div>
            )}

            {/* Items table */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Items ({order.order_items.length})</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Variety</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Unit</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.order_items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {item.variety}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="hidden text-right sm:table-cell">{item.unit}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        ${Number(item.unit_price).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Order totals */}
            {order.total > 0 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">${Number(order.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="tabular-nums">${Number(order.delivery_fee).toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">${Number(order.total).toFixed(2)}</span>
                </div>
              </div>
            )}

            <Separator />

            {/* Notes section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium">Notes</p>
              </div>

              {order.notes ? (
                <Card>
                  <CardContent className="py-3">
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-sans">
                      {order.notes}
                    </pre>
                  </CardContent>
                </Card>
              ) : (
                <p className="text-sm text-muted-foreground">No notes for this order.</p>
              )}

              <div className="flex gap-2">
                <Textarea
                  id="order-notes"
                  aria-label="Add a note to this order"
                  placeholder="Add a note..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-12"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteText.trim() || noteMutation.isPending}
                  className="shrink-0 self-end"
                >
                  {noteMutation.isPending ? "Saving..." : "Add"}
                </Button>
              </div>
            </div>

            {/* Delivery proof & route */}
            {order.status === "delivered" && (
              <>
                <DeliveryProofView orderId={order.id} />
                <DeliveryRouteView orderId={order.id} />
              </>
            )}
          </div>

          <Separator />

          {/* Admin actions */}
          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex flex-1 items-center gap-2">
              <Select
                value={order.status}
                onValueChange={(value: string) => {
                  onStatusChange(order.id, value as OrderStatus);
                }}
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {ORDER_STATUS_CONFIG[s.value as OrderStatus]?.label ?? s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {order.status !== "delivered" && order.status !== "cancelled" && (
              <AssignDriverDialog
                orderId={order.id}
                currentDriverId={order.assigned_driver_id ?? null}
                onAssigned={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
              />
            )}
            <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onOpenChange={(v) => {
          if (!v) setShowDeleteConfirm(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete order #{order.id.slice(0, 8)}? This action cannot be
              undone.
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
                onDelete(order.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
