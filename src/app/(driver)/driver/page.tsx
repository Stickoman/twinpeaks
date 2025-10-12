"use client";

import { DriverOrderList } from "@/components/driver/driver-order-list";

export default function DriverHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">My Deliveries</h2>
      <DriverOrderList />
    </div>
  );
}
