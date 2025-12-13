import type { Metadata } from "next";
import { StatsOverview } from "@/components/dashboard";

export const metadata: Metadata = {
  title: "Statistics",
};

export default function StatsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Statistics</h1>
        <p className="text-muted-foreground">Overview of orders, products, and performance.</p>
      </div>

      <StatsOverview />
    </div>
  );
}
