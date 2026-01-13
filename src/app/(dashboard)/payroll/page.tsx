"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  DollarSign,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { PayrollStatus } from "@/types/database";

interface DriverOption {
  id: string;
  username: string;
}

interface PayrollEntry {
  id: string;
  driver_id: string;
  driver_name: string;
  period_start: string;
  period_end: string;
  base_pay: number;
  delivery_bonus: number;
  total_pay: number;
  status: PayrollStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; variant: "default" | "secondary" | "outline"; className: string }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    className: "",
  },
  approved: {
    label: "Approved",
    variant: "outline",
    className: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: payroll = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["payroll", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/payroll?${params}`);
      if (!res.ok) throw new Error("Failed to load payroll");
      const json = (await res.json()) as { payroll: PayrollEntry[] };
      return json.payroll;
    },
  });

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json() as Promise<DriverOption[]>;
    },
    staleTime: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayrollStatus }) => {
      const res = await fetch(`/api/payroll/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll entry deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Summary stats
  const totalPending = payroll
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.total_pay, 0);
  const totalApproved = payroll
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.total_pay, 0);
  const totalPaid = payroll
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.total_pay, 0);

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div
        variants={fadeUpItem}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage driver salary payments</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Entry
          </Button>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={fadeUpItem} className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Clock className="size-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">${totalPending.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <CheckCircle2 className="size-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-lg font-bold">${totalApproved.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <DollarSign className="size-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold">${totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : payroll.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <DollarSign className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No payroll entries yet</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={fadeUpItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payroll Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Driver</th>
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 text-right font-medium">Base</th>
                      <th className="pb-2 text-right font-medium">Bonus</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payroll.map((entry) => {
                      const config = STATUS_CONFIG[entry.status];
                      return (
                        <tr key={entry.id}>
                          <td className="py-3 font-medium">{entry.driver_name}</td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(entry.period_start).toLocaleDateString()} —{" "}
                            {new Date(entry.period_end).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">${entry.base_pay}</td>
                          <td className="py-3 text-right">${entry.delivery_bonus}</td>
                          <td className="py-3 text-right font-medium">${entry.total_pay}</td>
                          <td className="py-3">
                            <Badge variant={config.variant} className={config.className}>
                              {config.label}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {entry.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Approve"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "approved" })
                                  }
                                >
                                  <ChevronUp className="size-4 text-blue-500" />
                                </Button>
                              )}
                              {entry.status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark Paid"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "paid" })
                                  }
                                >
                                  <CheckCircle2 className="size-4 text-emerald-500" />
                                </Button>
                              )}
                              {entry.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Revert to Pending"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "pending" })
                                  }
                                >
                                  <ChevronDown className="size-4 text-amber-500" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => deleteMutation.mutate(entry.id)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create dialog */}
      <CreatePayrollDialog open={showCreate} onOpenChange={setShowCreate} drivers={drivers} />
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Create payroll dialog
// ────────────────────────────────────────────────────────────

function CreatePayrollDialog({
  open,
  onOpenChange,
  drivers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: DriverOption[];
}) {
  const queryClient = useQueryClient();
  const [driverId, setDriverId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [basePay, setBasePay] = useState("");
  const [deliveryBonus, setDeliveryBonus] = useState("");

  const totalPay = (Number(basePay) || 0) + (Number(deliveryBonus) || 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          period_start: periodStart,
          period_end: periodEnd,
          base_pay: Number(basePay) || 0,
          delivery_bonus: Number(deliveryBonus) || 0,
          total_pay: totalPay,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Failed to create payroll entry");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll entry created");
      onOpenChange(false);
      setDriverId("");
      setPeriodStart("");
      setPeriodEnd("");
      setBasePay("");
      setDeliveryBonus("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payroll Entry</DialogTitle>
          <DialogDescription>Create a new salary payment record for a driver.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="base-pay">Base Pay ($)</Label>
              <Input
                id="base-pay"
                type="number"
                min="0"
                step="0.01"
                value={basePay}
                onChange={(e) => setBasePay(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-bonus">Delivery Bonus ($)</Label>
              <Input
                id="delivery-bonus"
                type="number"
                min="0"
                step="0.01"
                value={deliveryBonus}
                onChange={(e) => setDeliveryBonus(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Total Pay: </span>
            <span className="font-bold">${totalPay.toFixed(2)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!driverId || !periodStart || !periodEnd || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  DollarSign,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { PayrollStatus } from "@/types/database";

interface DriverOption {
  id: string;
  username: string;
}

interface PayrollEntry {
  id: string;
  driver_id: string;
  driver_name: string;
  period_start: string;
  period_end: string;
  base_pay: number;
  delivery_bonus: number;
  total_pay: number;
  status: PayrollStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<
  PayrollStatus,
  { label: string; variant: "default" | "secondary" | "outline"; className: string }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    className: "",
  },
  approved: {
    label: "Approved",
    variant: "outline",
    className: "border-blue-500/50 text-blue-600 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    variant: "default",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

export default function PayrollPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: payroll = [], isLoading } = useQuery<PayrollEntry[]>({
    queryKey: ["payroll", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.set("status", filterStatus);
      const res = await fetch(`/api/payroll?${params}`);
      if (!res.ok) throw new Error("Failed to load payroll");
      const json = (await res.json()) as { payroll: PayrollEntry[] };
      return json.payroll;
    },
  });

  const { data: drivers = [] } = useQuery<DriverOption[]>({
    queryKey: ["drivers-list"],
    queryFn: async () => {
      const res = await fetch("/api/drivers");
      if (!res.ok) throw new Error("Failed to load drivers");
      return res.json() as Promise<DriverOption[]>;
    },
    staleTime: 60_000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PayrollStatus }) => {
      const res = await fetch(`/api/payroll/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Status updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll entry deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Summary stats
  const totalPending = payroll
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.total_pay, 0);
  const totalApproved = payroll
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.total_pay, 0);
  const totalPaid = payroll
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.total_pay, 0);

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div
        variants={fadeUpItem}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Payroll</h1>
          <p className="text-sm text-muted-foreground">Manage driver salary payments</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Entry
          </Button>
        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div variants={fadeUpItem} className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <Clock className="size-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold">${totalPending.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <CheckCircle2 className="size-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-lg font-bold">${totalApproved.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-4">
            <DollarSign className="size-5 text-emerald-500" />
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold">${totalPaid.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : payroll.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <DollarSign className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No payroll entries yet</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div variants={fadeUpItem}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payroll Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Driver</th>
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 text-right font-medium">Base</th>
                      <th className="pb-2 text-right font-medium">Bonus</th>
                      <th className="pb-2 text-right font-medium">Total</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {payroll.map((entry) => {
                      const config = STATUS_CONFIG[entry.status];
                      return (
                        <tr key={entry.id}>
                          <td className="py-3 font-medium">{entry.driver_name}</td>
                          <td className="py-3 text-muted-foreground">
                            {new Date(entry.period_start).toLocaleDateString()} —{" "}
                            {new Date(entry.period_end).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-right">${entry.base_pay}</td>
                          <td className="py-3 text-right">${entry.delivery_bonus}</td>
                          <td className="py-3 text-right font-medium">${entry.total_pay}</td>
                          <td className="py-3">
                            <Badge variant={config.variant} className={config.className}>
                              {config.label}
                            </Badge>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {entry.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Approve"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "approved" })
                                  }
                                >
                                  <ChevronUp className="size-4 text-blue-500" />
                                </Button>
                              )}
                              {entry.status === "approved" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Mark Paid"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "paid" })
                                  }
                                >
                                  <CheckCircle2 className="size-4 text-emerald-500" />
                                </Button>
                              )}
                              {entry.status !== "paid" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Revert to Pending"
                                  onClick={() =>
                                    statusMutation.mutate({ id: entry.id, status: "pending" })
                                  }
                                >
                                  <ChevronDown className="size-4 text-amber-500" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => deleteMutation.mutate(entry.id)}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create dialog */}
      <CreatePayrollDialog open={showCreate} onOpenChange={setShowCreate} drivers={drivers} />
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Create payroll dialog
// ────────────────────────────────────────────────────────────

function CreatePayrollDialog({
  open,
  onOpenChange,
  drivers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drivers: DriverOption[];
}) {
  const queryClient = useQueryClient();
  const [driverId, setDriverId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [basePay, setBasePay] = useState("");
  const [deliveryBonus, setDeliveryBonus] = useState("");

  const totalPay = (Number(basePay) || 0) + (Number(deliveryBonus) || 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          driver_id: driverId,
          period_start: periodStart,
          period_end: periodEnd,
          base_pay: Number(basePay) || 0,
          delivery_bonus: Number(deliveryBonus) || 0,
          total_pay: totalPay,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Failed to create payroll entry");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      toast.success("Payroll entry created");
      onOpenChange(false);
      setDriverId("");
      setPeriodStart("");
      setPeriodEnd("");
      setBasePay("");
      setDeliveryBonus("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Payroll Entry</DialogTitle>
          <DialogDescription>Create a new salary payment record for a driver.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label>Driver</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a driver" />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="period-start">Period Start</Label>
              <Input
                id="period-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Period End</Label>
              <Input
                id="period-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="base-pay">Base Pay ($)</Label>
              <Input
                id="base-pay"
                type="number"
                min="0"
                step="0.01"
                value={basePay}
                onChange={(e) => setBasePay(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delivery-bonus">Delivery Bonus ($)</Label>
              <Input
                id="delivery-bonus"
                type="number"
                min="0"
                step="0.01"
                value={deliveryBonus}
                onChange={(e) => setDeliveryBonus(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="text-muted-foreground">Total Pay: </span>
            <span className="font-bold">${totalPay.toFixed(2)}</span>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!driverId || !periodStart || !periodEnd || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
