"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toast } from "sonner";

interface ShiftData {
  id: string;
  started_at: string;
  ended_at: string | null;
}

async function fetchShift(): Promise<ShiftData | null> {
  const res = await fetch("/api/driver/shift");
  if (!res.ok) return null;
  const data = (await res.json()) as { shift: ShiftData | null };
  return data.shift;
}

function formatElapsed(startedAt: string, now: number): string {
  const elapsed = Math.floor((now - new Date(startedAt).getTime()) / 60_000);
  const hours = Math.floor(elapsed / 60);
  const mins = elapsed % 60;
  return hours > 0 ? `${hours}h${mins.toString().padStart(2, "0")}` : `${mins}min`;
}

function ShiftTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <div className="size-1.5 rounded-full bg-emerald-500" />
      {formatElapsed(startedAt, now)}
    </Badge>
  );
}

export function ShiftIndicator() {
  const queryClient = useQueryClient();

  const { data: shift } = useQuery({
    queryKey: ["driver-shift"],
    queryFn: fetchShift,
    refetchInterval: 60_000,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/driver/shift", { method: "POST" });
      if (!res.ok) throw new Error("Failed to start shift");
      return res.json() as Promise<{ shift: ShiftData }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-shift"] });
      toast.success("Shift started");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (shift) {
    return <ShiftTimer startedAt={shift.started_at} />;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => startMutation.mutate()}
      disabled={startMutation.isPending}
    >
      <Play className="size-3" />
      Start Shift
    </Button>
  );
}
