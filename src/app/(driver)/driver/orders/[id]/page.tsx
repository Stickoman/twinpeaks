"use client";

import { use } from "react";
import { DriverOrderDetail } from "@/components/driver/driver-order-detail";

export default function DriverOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DriverOrderDetail orderId={id} />;
}
