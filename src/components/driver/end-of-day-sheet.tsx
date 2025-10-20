"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Package, Route, DollarSign, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface ShiftData {
  id: string;
  started_at: string;
  ended_at: string | null;
  orders_completed: number;
  total_distance_km: number;
  total_revenue: number;
}

interface EndShiftResult {
  shift: ShiftData;
}

export function EndOfDaySheet() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [ended, setEnded] = useState(false);
  const [result, setResult] = useState<ShiftData | null>(null);

  const { data: shift } = useQuery({
    queryKey: ["driver-shift"],
    queryFn: async () => {
      const res = await fetch("/api/driver/shift");
      if (!res.ok) return null;
      const data = (await res.json()) as { shift: ShiftData | null };
      return data.shift;
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/driver/shift/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to end shift");
      return res.json() as Promise<EndShiftResult>;
    },
    onSuccess: (data) => {
      setResult(data.shift);
      setEnded(true);
      queryClient.invalidateQueries({ queryKey: ["driver-shift"] });
      queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
      toast.success("Shift ended — good work!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleClose = () => {
    setOpen(false);
    setEnded(false);
    setResult(null);
    setNotes("");
  };

  if (!shift) return null;

  return (
    <Drawer open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Moon className="size-3.5" />
          End of Day
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md p-4">
          <DrawerHeader className="px-0">
            <DrawerTitle>{ended ? "Shift Summary" : "End Your Shift"}</DrawerTitle>
          </DrawerHeader>

          {ended && result ? (
            <div className="space-y-4 pb-6">
              <div className="flex items-center justify-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Check className="size-7 text-emerald-600" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <Package className="mx-auto size-4 text-muted-foreground" />
                  <p className="mt-1 text-xl font-bold">{result.orders_completed}</p>
                  <p className="text-xs text-muted-foreground">Deliveries</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <Route className="mx-auto size-4 text-muted-foreground" />
                  <p className="mt-1 text-xl font-bold">{result.total_distance_km}</p>
                  <p className="text-xs text-muted-foreground">km</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <DollarSign className="mx-auto size-4 text-muted-foreground" />
                  <p className="mt-1 text-xl font-bold">{result.total_revenue.toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                </div>
              </div>

              <Button className="w-full" onClick={handleClose}>
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pb-6">
              <p className="text-sm text-muted-foreground">
                This will close your current shift and calculate your daily stats. You can add
                optional notes below.
              </p>
              <Textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => endMutation.mutate()}
                  disabled={endMutation.isPending}
                >
                  {endMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Moon className="size-4" />
                  )}
                  {endMutation.isPending ? "Ending..." : "End Shift"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
