"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Check, MapPin, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { PhotoCapture } from "./photo-capture";
import { useGpsStore } from "@/stores/gps-store";

interface ConfirmDeliveryPayload {
  delivery_code: string;
  photo_url?: string;
  notes?: string;
  latitude: number;
  longitude: number;
}

async function confirmDelivery(orderId: string, data: ConfirmDeliveryPayload): Promise<void> {
  const res = await fetch(`/api/driver/orders/${orderId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Failed to confirm delivery");
  }
}

export function DeliveryConfirmSheet({ orderId }: { orderId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const gps = useGpsStore();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deliveryCode, setDeliveryCode] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: (data: ConfirmDeliveryPayload) => confirmDelivery(orderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-orders"] });
      queryClient.invalidateQueries({ queryKey: ["driver-order", orderId] });
      setShowSuccess(true);
      setTimeout(() => {
        setOpen(false);
        setShowSuccess(false);
        router.push("/driver");
      }, 1500);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleConfirm = () => {
    if (!/^\d{4}$/.test(deliveryCode)) {
      toast.error("Please enter the 4-digit delivery code");
      return;
    }

    // Use GPS store position if available, otherwise fallback to getCurrentPosition
    if (gps.latitude && gps.longitude) {
      mutation.mutate({
        delivery_code: deliveryCode,
        photo_url: photoUrl ?? undefined,
        notes: notes || undefined,
        latitude: gps.latitude,
        longitude: gps.longitude,
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGettingLocation(false);
        mutation.mutate({
          delivery_code: deliveryCode,
          photo_url: photoUrl ?? undefined,
          notes: notes || undefined,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setGettingLocation(false);
        mutation.mutate({
          delivery_code: deliveryCode,
          photo_url: photoUrl ?? undefined,
          notes: notes || undefined,
          latitude: 0,
          longitude: 0,
        });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button className="w-full" size="lg" variant="default">
          <Check className="size-5" />
          Confirm Delivery
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <AnimatePresence mode="wait">
          {showSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-16"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
                className="flex size-20 items-center justify-center rounded-full bg-emerald-500"
              >
                <Check className="size-10 text-white" strokeWidth={3} />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-lg font-bold text-emerald-600"
              >
                Delivery Confirmed!
              </motion.p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DrawerHeader>
                <DrawerTitle>Confirm Delivery</DrawerTitle>
                <DrawerDescription>Enter the delivery code and capture a photo.</DrawerDescription>
              </DrawerHeader>

              <div className="space-y-4 px-4">
                {/* Delivery code — large input */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <KeyRound className="size-3.5" />
                    Delivery Code
                  </Label>
                  <Input
                    placeholder="0000"
                    value={deliveryCode}
                    onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    maxLength={4}
                    className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Ask the customer for their 4-digit delivery code
                  </p>
                </div>

                {/* Photo */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Camera className="size-3.5" />
                    Delivery Photo
                  </Label>
                  <PhotoCapture value={photoUrl} onChange={setPhotoUrl} />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="e.g. Left at front door..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-20"
                  />
                </div>

                {/* GPS indicator */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {gps.status === "active" ? (
                    <span className="text-emerald-600">GPS location active</span>
                  ) : (
                    <span>GPS location will be recorded</span>
                  )}
                </div>
              </div>

              <DrawerFooter>
                <Button
                  onClick={handleConfirm}
                  disabled={mutation.isPending || gettingLocation || deliveryCode.length !== 4}
                  size="lg"
                  className="w-full"
                >
                  {gettingLocation ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Getting location...
                    </>
                  ) : mutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <Check className="size-5" />
                      Confirm Delivery
                    </>
                  )}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DrawerContent>
    </Drawer>
  );
}
