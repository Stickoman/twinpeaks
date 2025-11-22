"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Profile } from "@/types/database";

type DriverProfile = Pick<Profile, "id" | "username" | "phone" | "is_active">;

async function fetchDrivers(): Promise<DriverProfile[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to load drivers");
  return res.json() as Promise<DriverProfile[]>;
}

async function assignDriver(orderId: string, driverId: string): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ driver_id: driverId }),
  });
  if (!res.ok) throw new Error("Failed to assign driver");
}

async function unassignDriver(orderId: string): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}/unassign`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to unassign driver");
}

interface AssignDriverDialogProps {
  orderId: string;
  currentDriverId: string | null;
  onAssigned?: () => void;
}

export function AssignDriverDialog({
  orderId,
  currentDriverId,
  onAssigned,
}: AssignDriverDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<string>("");

  const { data: drivers = [], isLoading: driversLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
    enabled: open,
  });

  const activeDrivers = useMemo(() => drivers.filter((d) => d.is_active), [drivers]);

  const assignMutation = useMutation({
    mutationFn: () => assignDriver(orderId, selectedDriver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Driver assigned");
      setOpen(false);
      onAssigned?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const unassignMutation = useMutation({
    mutationFn: () => unassignDriver(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Driver unassigned");
      setOpen(false);
      onAssigned?.();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {currentDriverId ? (
            <>
              <Truck className="size-4" />
              Reassign
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              Assign Driver
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Driver</DialogTitle>
          <DialogDescription>Select a driver for order #{orderId.slice(0, 8)}</DialogDescription>
        </DialogHeader>

        <Select value={selectedDriver} onValueChange={setSelectedDriver}>
          <SelectTrigger>
            <SelectValue placeholder={driversLoading ? "Loading..." : "Select a driver..."} />
          </SelectTrigger>
          <SelectContent>
            {activeDrivers.length === 0 && !driversLoading ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No active drivers available
              </p>
            ) : (
              activeDrivers.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  {driver.username}
                  {driver.phone ? ` (${driver.phone})` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <DialogFooter className="gap-2">
          {currentDriverId && (
            <Button
              variant="outline"
              onClick={() => unassignMutation.mutate()}
              disabled={unassignMutation.isPending}
            >
              {unassignMutation.isPending ? "Removing..." : "Remove Driver"}
            </Button>
          )}
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!selectedDriver || assignMutation.isPending}
          >
            {assignMutation.isPending ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
