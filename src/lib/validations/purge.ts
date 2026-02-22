import { z } from "zod";

export const purgeTimeRange = z.enum([
  "day",
  "week",
  "month",
  "3months",
  "6months",
  "12months",
  "all",
]);

export type PurgeTimeRange = z.infer<typeof purgeTimeRange>;

export const purgeSchema = z.object({
  scope: z.enum(["driver", "site"]),
  driver_id: z.string().uuid().optional(),
  time_range: purgeTimeRange,
});

export type PurgeInput = z.infer<typeof purgeSchema>;

/** Compute cutoff date from time range */
export function getCutoffDate(range: PurgeTimeRange): Date | null {
  if (range === "all") return null;

  const now = new Date();
  switch (range) {
    case "day":
      now.setDate(now.getDate() - 1);
      break;
    case "week":
      now.setDate(now.getDate() - 7);
      break;
    case "month":
      now.setMonth(now.getMonth() - 1);
      break;
    case "3months":
      now.setMonth(now.getMonth() - 3);
      break;
    case "6months":
      now.setMonth(now.getMonth() - 6);
      break;
    case "12months":
      now.setFullYear(now.getFullYear() - 1);
      break;
  }
  return now;
}

export const TIME_RANGE_LABELS: Record<PurgeTimeRange, string> = {
  day: "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
  "3months": "Last 3 months",
  "6months": "Last 6 months",
  "12months": "Last 12 months",
  all: "All time",
};
