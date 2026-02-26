"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trash2, AlertTriangle, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { MfaGate } from "@/components/auth/mfa-gate";
import { TIME_RANGE_LABELS, type PurgeTimeRange } from "@/lib/validations/purge";

interface DriverOption {
  id: string;
  username: string;
}

interface PreviewResult {
  counts: Record<string, number>;
  totalRecords: number;
}

interface PurgeResult {
  deleted: Record<string, number>;
  totalDeleted: number;
}

const TABLE_LABELS: Record<string, string> = {
  orders: "Orders",
  order_items: "Order Items",
  delivery_proofs: "Delivery Proofs",
  delivery_routes: "Delivery Routes",
  driver_locations: "Driver Locations",
  driver_shifts: "Driver Shifts",
  push_subscriptions: "Push Subscriptions",
  chat_messages: "Chat Messages",
  audit_logs: "Audit Logs",
};

export default function DataManagementPage() {
  const [scope, setScope] = useState<"driver" | "site">("driver");
  const [driverId, setDriverId] = useState("");
  const [timeRange, setTimeRange] = useState<PurgeTimeRange>("month");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json() as Promise<DriverOption[]>;
    },
    staleTime: 60_000,
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/purge/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          driver_id: scope === "driver" ? driverId : undefined,
          time_range: timeRange,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Preview failed");
      }
      return res.json() as Promise<PreviewResult>;
    },
    onSuccess: (data) => setPreview(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope,
          driver_id: scope === "driver" ? driverId : undefined,
          time_range: timeRange,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Purge failed");
      }
      return res.json() as Promise<PurgeResult>;
    },
    onSuccess: (data) => {
      setShowConfirm(false);
      setPreview(null);
      toast.success(`Deleted ${data.totalDeleted} records`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const driverName = drivers.find((d) => d.id === driverId)?.username;

  return (
    <MfaGate>
      <motion.div
        className="space-y-6"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        <motion.div variants={fadeUpItem}>
          <h1 className="text-2xl font-bold">Data Management</h1>
          <p className="text-sm text-muted-foreground">
            Permanently delete data. This action cannot be undone.
          </p>
        </motion.div>

        {/* Warning */}
        <motion.div variants={fadeUpItem}>
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start gap-3 pt-4">
              <AlertTriangle className="size-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Danger Zone</p>
                <p className="text-muted-foreground">
                  This page performs hard DELETE operations. Deleted data cannot be recovered. All
                  cascading records (order items, delivery proofs, routes, etc.) will also be
                  removed.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Configuration */}
        <motion.div variants={fadeUpItem}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="size-4" />
                Purge Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select
                    value={scope}
                    onValueChange={(v) => {
                      setScope(v as "driver" | "site");
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="driver">Per Driver</SelectItem>
                      <SelectItem value="site">Site-Wide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {scope === "driver" && (
                  <div className="space-y-2">
                    <Label>Driver</Label>
                    <Select
                      value={driverId}
                      onValueChange={(v) => {
                        setDriverId(v);
                        setPreview(null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Time Range</Label>
                  <Select
                    value={timeRange}
                    onValueChange={(v) => {
                      setTimeRange(v as PurgeTimeRange);
                      setPreview(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIME_RANGE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                variant="outline"
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending || (scope === "driver" && !driverId)}
              >
                {previewMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Preview Deletion
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Preview results */}
        {preview && (
          <motion.div variants={fadeUpItem}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trash2 className="size-4 text-destructive" />
                  Preview — {preview.totalRecords} records will be deleted
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(preview.counts)
                    .filter(([, count]) => count > 0)
                    .map(([table, count]) => (
                      <div
                        key={table}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <span className="text-sm">{TABLE_LABELS[table] ?? table}</span>
                        <Badge variant="destructive">{count}</Badge>
                      </div>
                    ))}
                </div>

                {preview.totalRecords === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No records match the selected criteria.
                  </p>
                ) : (
                  <>
                    <Separator />
                    <Button variant="destructive" onClick={() => setShowConfirm(true)}>
                      <Trash2 className="size-4" />
                      Delete {preview.totalRecords} Records
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Confirmation dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                Confirm Permanent Deletion
              </DialogTitle>
              <DialogDescription>
                You are about to permanently delete{" "}
                <span className="font-bold text-foreground">
                  {preview?.totalRecords ?? 0} records
                </span>
                {scope === "driver" && driverName && (
                  <>
                    {" "}
                    for driver <span className="font-bold text-foreground">{driverName}</span>
                  </>
                )}
                {scope === "site" && " across the entire site"} from the{" "}
                {TIME_RANGE_LABELS[timeRange].toLowerCase()} period.
                <br />
                <br />
                <span className="font-bold text-destructive">
                  This action cannot be undone. Zero trace will remain.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => purgeMutation.mutate()}
                disabled={purgeMutation.isPending}
              >
                {purgeMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                Yes, Delete Everything
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </MfaGate>
  );
}
