export type StockAvailability = "available" | "low" | "unavailable";

export function getAvailabilityStatus(
  quantity: number,
  threshold: number | null,
  categoryThreshold: number | null,
): StockAvailability {
  if (quantity <= 0) return "unavailable";
  const effectiveThreshold = threshold ?? categoryThreshold ?? 10;
  if (quantity <= effectiveThreshold) return "low";
  return "available";
}

export function getAvailabilityBadgeConfig(status: StockAvailability) {
  switch (status) {
    case "available":
      return {
        label: "In Stock",
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      };
    case "low":
      return {
        label: "Low Stock",
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
      };
    case "unavailable":
      return {
        label: "Out of Stock",
        className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      };
  }
}
