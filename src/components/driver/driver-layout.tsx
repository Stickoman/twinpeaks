"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Package,
  Map,
  User,
  Clock,
  Signal,
  SignalLow,
  SignalZero,
  WifiOff,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleMapsProvider } from "@/components/ui/google-maps-provider";
import { GPSTracker } from "./gps-tracker";
import { ShiftIndicator } from "./shift-indicator";
import { EndOfDaySheet } from "./end-of-day-sheet";
import { ChatFAB } from "@/components/chat/chat-fab";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { useGpsStore, type GpsStatus } from "@/stores/gps-store";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

// ────────────────────────────────────────────────────────────
// Nav items
// ────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/driver", label: "Orders", icon: Package, badge: true },
  { href: "/driver/route", label: "Route", icon: Map, badge: false },
  { href: "/driver/history", label: "History", icon: Clock, badge: false },
  { href: "/driver/profile", label: "Profile", icon: User, badge: false },
];

// ────────────────────────────────────────────────────────────
// GPS status indicator
// ────────────────────────────────────────────────────────────

const GPS_CONFIG: Record<GpsStatus, { icon: typeof Signal; color: string; label: string }> = {
  active: { icon: Signal, color: "text-emerald-500", label: "GPS Active" },
  searching: { icon: SignalLow, color: "text-amber-500", label: "Searching..." },
  error: { icon: SignalZero, color: "text-red-500", label: "GPS Error" },
  denied: { icon: WifiOff, color: "text-red-500", label: "GPS Denied" },
  unavailable: { icon: WifiOff, color: "text-muted-foreground", label: "No GPS" },
};

function GpsIndicator() {
  const gps = useGpsStore();
  const config = GPS_CONFIG[gps.status];
  const Icon = config.icon;

  const handleTap = () => {
    if (gps.status === "denied") {
      // Try to re-request — if browser blocks it, show a help message
      navigator.geolocation.getCurrentPosition(
        () => {
          toast.success("GPS enabled!");
        },
        () => {
          toast("GPS permission denied", {
            description: "Open your browser settings to allow location access for this site.",
            duration: 5000,
          });
        },
        { timeout: 5000 },
      );
    } else if (gps.status === "error") {
      toast("GPS error — retrying...");
      navigator.geolocation.getCurrentPosition(
        () => toast.success("GPS recovered!"),
        () => toast.error("GPS still unavailable"),
        { timeout: 10000 },
      );
    }
  };

  const isInteractive = gps.status === "denied" || gps.status === "error";

  return (
    <button
      type="button"
      className={cn("flex items-center gap-1.5", isInteractive && "active:opacity-70")}
      onClick={handleTap}
      disabled={!isInteractive}
    >
      <Icon className={cn("size-4", config.color)} />
      <span className="text-xs text-muted-foreground">{config.label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
// Order count badge hook
// ────────────────────────────────────────────────────────────

interface DriverOrderSummary {
  id: string;
  address: string;
  status: string;
}

interface DriverOrdersResponse {
  assigned: DriverOrderSummary[];
  pending: unknown[];
  is_trusted: boolean;
}

function useDriverOrders() {
  const { data } = useQuery({
    queryKey: ["driver-orders-count"],
    queryFn: async () => {
      const res = await fetch("/api/driver/orders");
      if (!res.ok) return { count: 0, enRouteAddress: null };
      const json = (await res.json()) as DriverOrdersResponse;
      const enRoute = json.assigned.find((o) => o.status === "en_route");
      return {
        count: json.assigned.length,
        enRouteAddress: enRoute?.address ?? null,
      };
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });
  return { orderCount: data?.count ?? 0, enRouteAddress: data?.enRouteAddress ?? null };
}

// ────────────────────────────────────────────────────────────
// Layout
// ────────────────────────────────────────────────────────────

export function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { orderCount, enRouteAddress } = useDriverOrders();

  return (
    <GoogleMapsProvider>
      <div className="flex min-h-[100dvh] flex-col bg-background">
        {/* GPS Tracker (background service) */}
        <GPSTracker />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b bg-background/95 px-4 backdrop-blur">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">TP Driver</h1>
              <ShiftIndicator />
            </div>
            <div className="flex items-center gap-2">
              <EndOfDaySheet />
              <GpsIndicator />
            </div>
          </div>
          {enRouteAddress && (
            <div className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0 text-primary" />
              <span className="truncate">{enRouteAddress}</span>
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-4 pb-20">{children}</main>

        {/* Chat */}
        <ChatFAB />
        <ChatDrawer bottomOffset="bottom-14" />

        {/* Bottom Tab Navigation — mobile-first */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/driver"
                  ? pathname === "/driver" || pathname.startsWith("/driver/orders")
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              const count = item.badge ? orderCount : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 px-4 py-2.5 text-xs transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <div className="relative">
                    <Icon className="size-5" />
                    {count > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {count > 9 ? "9+" : count}
                      </span>
                    )}
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </GoogleMapsProvider>
  );
}
