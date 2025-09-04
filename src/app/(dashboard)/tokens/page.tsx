import type { Metadata } from "next";
import { Suspense } from "react";
import { Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TokenGenerator } from "@/components/forms";

export const metadata: Metadata = {
  title: "Secure Tokens",
};

function TokenGeneratorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-48" />
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="rounded-xl border p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TokensPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Shield className="size-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Secure Links</h1>
        </div>
        <p className="text-muted-foreground">
          Generate temporary access links for order forms. Each link expires after 15 minutes.
        </p>
      </div>

      <Suspense fallback={<TokenGeneratorSkeleton />}>
        <TokenGenerator />
      </Suspense>
    </div>
  );
}
