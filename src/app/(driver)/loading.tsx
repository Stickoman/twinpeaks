import { Skeleton } from "@/components/ui/skeleton";

export default function DriverLoading() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
