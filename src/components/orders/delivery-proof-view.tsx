"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { Camera, MapPin, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils/helpers";
import type { DeliveryProof } from "@/types/database";

async function fetchProof(orderId: string): Promise<DeliveryProof | null> {
  const res = await fetch(`/api/orders/${orderId}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { delivery_proof?: DeliveryProof };
  return data.delivery_proof ?? null;
}

export function DeliveryProofView({ orderId }: { orderId: string }) {
  const { data: proof, isLoading } = useQuery({
    queryKey: ["delivery-proof", orderId],
    queryFn: () => fetchProof(orderId),
    staleTime: 60_000,
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-lg" />;
  if (!proof) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Camera className="size-4" />
          Delivery Proof
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {proof.photo_url && (
          <Image
            src={proof.photo_url}
            alt="Delivery proof"
            width={400}
            height={300}
            className="w-full rounded-lg object-cover"
          />
        )}
        {proof.notes && <p className="text-sm">{proof.notes}</p>}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {proof.latitude && proof.longitude && (
            <span className="flex items-center gap-1">
              <MapPin className="size-3" />
              {proof.latitude.toFixed(4)}, {proof.longitude.toFixed(4)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {formatDate(proof.created_at)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
