import { Clock, Truck, Check, X, UserCheck } from "lucide-react";
import type { OrderStatus } from "@/types/database";

export const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    icon: React.ElementType;
    badgeClass: string;
    cardClass: string;
    color: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock,
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    cardClass: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    color: "#f59e0b",
  },
  assigned: {
    label: "Assigned",
    icon: UserCheck,
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
    cardClass: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300",
    color: "#8b5cf6",
  },
  en_route: {
    label: "In Transit",
    icon: Truck,
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    cardClass: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    color: "#3b82f6",
  },
  delivered: {
    label: "Delivered",
    icon: Check,
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    cardClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
    color: "#22c55e",
  },
  cancelled: {
    label: "Cancelled",
    icon: X,
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    cardClass: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    color: "#ef4444",
  },
};

export function getRoleLabel(role: string): string {
  switch (role) {
    case "god_admin":
      return "God Admin";
    case "super_admin":
      return "Super Admin";
    case "admin":
      return "Admin";
    default:
      return role;
  }
}
