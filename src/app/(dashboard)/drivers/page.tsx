"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  Truck,
  Phone,
  Car,
  MoreHorizontal,
  Trash2,
  Power,
  ClipboardList,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

import type { Profile } from "@/types/database";
import { createDriverSchema, type CreateDriverInput } from "@/lib/validations/driver";
import { MfaGate } from "@/components/auth/mfa-gate";
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

type DriverProfile = Pick<
  Profile,
  "id" | "username" | "phone" | "vehicle_info" | "is_active" | "is_trusted" | "created_at"
>;

async function fetchDrivers(): Promise<DriverProfile[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to load drivers");
  return res.json() as Promise<DriverProfile[]>;
}

async function createDriver(data: {
  username: string;
  password: string;
  phone?: string;
  vehicle_info?: string;
}): Promise<DriverProfile> {
  const res = await fetch("/api/drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to create driver");
  }
  return res.json() as Promise<DriverProfile>;
}

async function toggleDriverActive(id: string, isActive: boolean): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) throw new Error("Failed to update driver");
}

async function toggleDriverTrusted(id: string, isTrusted: boolean): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_trusted: isTrusted }),
  });
  if (!res.ok) throw new Error("Failed to update driver");
}

async function deleteDriver(id: string): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete driver");
}

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DriverProfile | null>(null);

  const form = useForm<CreateDriverInput>({
    resolver: zodResolver(createDriverSchema),
    defaultValues: { username: "", password: "", phone: "", vehicle_info: "" },
  });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });

  const createMutation = useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Driver created");
      setShowCreate(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleDriverActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["drivers"] });
      const previous = queryClient.getQueryData<DriverProfile[]>(["drivers"]);
      queryClient.setQueryData<DriverProfile[]>(
        ["drivers"],
        (old) => old?.map((d) => (d.id === id ? { ...d, is_active: isActive } : d)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["drivers"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
    onSuccess: () => toast.success("Driver updated"),
  });

  const trustedMutation = useMutation({
    mutationFn: ({ id, isTrusted }: { id: string; isTrusted: boolean }) =>
      toggleDriverTrusted(id, isTrusted),
    onMutate: async ({ id, isTrusted }) => {
      await queryClient.cancelQueries({ queryKey: ["drivers"] });
      const previous = queryClient.getQueryData<DriverProfile[]>(["drivers"]);
      queryClient.setQueryData<DriverProfile[]>(
        ["drivers"],
        (old) => old?.map((d) => (d.id === id ? { ...d, is_trusted: isTrusted } : d)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["drivers"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
    onSuccess: () => toast.success("Driver updated"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDeleteTarget(null);
      toast.success("Driver deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCreate(data: CreateDriverInput) {
    createMutation.mutate({
      username: data.username,
      password: data.password,
      phone: data.phone || undefined,
      vehicle_info: data.vehicle_info || undefined,
    });
  }

  return (
    <MfaGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Drivers</h1>
            <p className="text-sm text-muted-foreground">Manage delivery drivers</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Driver
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Truck className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No drivers yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" />
                Add First Driver
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
            {drivers.map((driver) => (
              <motion.div key={driver.id} variants={fadeUpItem}>
                <Card>
                  <CardContent className="flex items-start justify-between py-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{driver.username}</p>
                        <Badge
                          variant={driver.is_active ? "default" : "secondary"}
                          className={
                            driver.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {driver.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {driver.is_trusted && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                          >
                            <ShieldCheck className="mr-1 size-3" />
                            Trusted
                          </Badge>
                        )}
                      </div>
                      {driver.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3" />
                          {driver.phone}
                        </div>
                      )}
                      {driver.vehicle_info && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Car className="size-3" />
                          {driver.vehicle_info}
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/drivers/${driver.id}`}>
                            <BarChart3 className="size-4" />
                            View Metrics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/orders?driver=${driver.id}`}>
                            <ClipboardList className="size-4" />
                            View Orders
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleMutation.mutate({
                              id: driver.id,
                              isActive: !driver.is_active,
                            })
                          }
                        >
                          <Power className="size-4" />
                          {driver.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            trustedMutation.mutate({
                              id: driver.id,
                              isTrusted: !driver.is_trusted,
                            })
                          }
                        >
                          <ShieldCheck className="size-4" />
                          {driver.is_trusted ? "Remove Trusted" : "Mark Trusted"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(driver)}
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

        {/* Create Driver Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
              <DialogDescription>Create a new driver account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-username">Username *</Label>
                <Input
                  id="driver-username"
                  {...form.register("username")}
                  placeholder="driver_name"
                  aria-invalid={!!form.formState.errors.username}
                />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.username.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-password">Password *</Label>
                <Input
                  id="driver-password"
                  type="password"
                  {...form.register("password")}
                  placeholder="Min 12 chars, upper+lower+number"
                  aria-invalid={!!form.formState.errors.password}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-phone">Phone</Label>
                <Input id="driver-phone" {...form.register("phone")} placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-vehicle">Vehicle Info</Label>
                <Input
                  id="driver-vehicle"
                  {...form.register("vehicle_info")}
                  placeholder="e.g. Black Honda Civic 2022"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Driver"}
                </Button>
              </DialogFooter>
            </form>
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
              <DialogTitle>Delete Driver</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.username}</span>? This cannot be
                undone.
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
    </MfaGate>
  );
}
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Plus,
  Truck,
  Phone,
  Car,
  MoreHorizontal,
  Trash2,
  Power,
  ClipboardList,
  ShieldCheck,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";

import type { Profile } from "@/types/database";
import { createDriverSchema, type CreateDriverInput } from "@/lib/validations/driver";
import { MfaGate } from "@/components/auth/mfa-gate";
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

type DriverProfile = Pick<
  Profile,
  "id" | "username" | "phone" | "vehicle_info" | "is_active" | "is_trusted" | "created_at"
>;

async function fetchDrivers(): Promise<DriverProfile[]> {
  const res = await fetch("/api/drivers");
  if (!res.ok) throw new Error("Failed to load drivers");
  return res.json() as Promise<DriverProfile[]>;
}

async function createDriver(data: {
  username: string;
  password: string;
  phone?: string;
  vehicle_info?: string;
}): Promise<DriverProfile> {
  const res = await fetch("/api/drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to create driver");
  }
  return res.json() as Promise<DriverProfile>;
}

async function toggleDriverActive(id: string, isActive: boolean): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) throw new Error("Failed to update driver");
}

async function toggleDriverTrusted(id: string, isTrusted: boolean): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_trusted: isTrusted }),
  });
  if (!res.ok) throw new Error("Failed to update driver");
}

async function deleteDriver(id: string): Promise<void> {
  const res = await fetch(`/api/drivers/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete driver");
}

export default function DriversPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DriverProfile | null>(null);

  const form = useForm<CreateDriverInput>({
    resolver: zodResolver(createDriverSchema),
    defaultValues: { username: "", password: "", phone: "", vehicle_info: "" },
  });

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["drivers"],
    queryFn: fetchDrivers,
  });

  const createMutation = useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      toast.success("Driver created");
      setShowCreate(false);
      form.reset();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      toggleDriverActive(id, isActive),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["drivers"] });
      const previous = queryClient.getQueryData<DriverProfile[]>(["drivers"]);
      queryClient.setQueryData<DriverProfile[]>(
        ["drivers"],
        (old) => old?.map((d) => (d.id === id ? { ...d, is_active: isActive } : d)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["drivers"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
    onSuccess: () => toast.success("Driver updated"),
  });

  const trustedMutation = useMutation({
    mutationFn: ({ id, isTrusted }: { id: string; isTrusted: boolean }) =>
      toggleDriverTrusted(id, isTrusted),
    onMutate: async ({ id, isTrusted }) => {
      await queryClient.cancelQueries({ queryKey: ["drivers"] });
      const previous = queryClient.getQueryData<DriverProfile[]>(["drivers"]);
      queryClient.setQueryData<DriverProfile[]>(
        ["drivers"],
        (old) => old?.map((d) => (d.id === id ? { ...d, is_trusted: isTrusted } : d)) ?? [],
      );
      return { previous };
    },
    onError: (err: Error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["drivers"], ctx.previous);
      toast.error(err.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["drivers"] }),
    onSuccess: () => toast.success("Driver updated"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDriver,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      setDeleteTarget(null);
      toast.success("Driver deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleCreate(data: CreateDriverInput) {
    createMutation.mutate({
      username: data.username,
      password: data.password,
      phone: data.phone || undefined,
      vehicle_info: data.vehicle_info || undefined,
    });
  }

  return (
    <MfaGate>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Drivers</h1>
            <p className="text-sm text-muted-foreground">Manage delivery drivers</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            Add Driver
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <Truck className="size-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No drivers yet</p>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="size-4" />
                Add First Driver
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
            {drivers.map((driver) => (
              <motion.div key={driver.id} variants={fadeUpItem}>
                <Card>
                  <CardContent className="flex items-start justify-between py-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{driver.username}</p>
                        <Badge
                          variant={driver.is_active ? "default" : "secondary"}
                          className={
                            driver.is_active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : ""
                          }
                        >
                          {driver.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {driver.is_trusted && (
                          <Badge
                            variant="outline"
                            className="border-amber-500/50 text-amber-600 dark:text-amber-400"
                          >
                            <ShieldCheck className="mr-1 size-3" />
                            Trusted
                          </Badge>
                        )}
                      </div>
                      {driver.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Phone className="size-3" />
                          {driver.phone}
                        </div>
                      )}
                      {driver.vehicle_info && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Car className="size-3" />
                          {driver.vehicle_info}
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/drivers/${driver.id}`}>
                            <BarChart3 className="size-4" />
                            View Metrics
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/orders?driver=${driver.id}`}>
                            <ClipboardList className="size-4" />
                            View Orders
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toggleMutation.mutate({
                              id: driver.id,
                              isActive: !driver.is_active,
                            })
                          }
                        >
                          <Power className="size-4" />
                          {driver.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            trustedMutation.mutate({
                              id: driver.id,
                              isTrusted: !driver.is_trusted,
                            })
                          }
                        >
                          <ShieldCheck className="size-4" />
                          {driver.is_trusted ? "Remove Trusted" : "Mark Trusted"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(driver)}
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

        {/* Create Driver Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Driver</DialogTitle>
              <DialogDescription>Create a new driver account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="driver-username">Username *</Label>
                <Input
                  id="driver-username"
                  {...form.register("username")}
                  placeholder="driver_name"
                  aria-invalid={!!form.formState.errors.username}
                />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.username.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-password">Password *</Label>
                <Input
                  id="driver-password"
                  type="password"
                  {...form.register("password")}
                  placeholder="Min 12 chars, upper+lower+number"
                  aria-invalid={!!form.formState.errors.password}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-phone">Phone</Label>
                <Input id="driver-phone" {...form.register("phone")} placeholder="(555) 123-4567" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="driver-vehicle">Vehicle Info</Label>
                <Input
                  id="driver-vehicle"
                  {...form.register("vehicle_info")}
                  placeholder="e.g. Black Honda Civic 2022"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Driver"}
                </Button>
              </DialogFooter>
            </form>
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
              <DialogTitle>Delete Driver</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{" "}
                <span className="font-semibold">{deleteTarget?.username}</span>? This cannot be
                undone.
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
    </MfaGate>
  );
}
