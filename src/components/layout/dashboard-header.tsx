"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Sun, Moon, ChevronRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { DashboardSidebar } from "./dashboard-sidebar";
import { getRoleLabel } from "@/lib/utils/order-status";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface UserInfo {
  username: string;
  role: string;
}

// ────────────────────────────────────────────────────────────
// Breadcrumb helpers
// ────────────────────────────────────────────────────────────

const breadcrumbMap: Record<string, string> = {
  "/": "Dashboard",
  "/inventory": "Inventory",
  "/orders": "Orders",
  "/tokens": "Secure Links",
  "/stats": "Statistics",
  "/settings": "Settings",
};

function getBreadcrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [{ label: "Dashboard", href: "/" }];

  if (segments.length > 0) {
    let currentPath = "";
    for (const segment of segments) {
      currentPath += `/${segment}`;
      const label = breadcrumbMap[currentPath] ?? segment;
      crumbs.push({ label, href: currentPath });
    }
  }

  return crumbs;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function DashboardHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const breadcrumbs = getBreadcrumbs(pathname);

  useEffect(() => setMounted(true), []);

  const { data: user } = useQuery<UserInfo | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return res.json() as Promise<UserInfo>;
    },
    staleTime: Infinity,
  });

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="size-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0" showCloseButton>
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <DashboardSidebar />
        </SheetContent>
      </Sheet>

      {/* Mobile page title */}
      <span className="text-sm font-medium text-foreground md:hidden">
        {breadcrumbs[breadcrumbs.length - 1]?.label}
      </span>

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="hidden items-center gap-1 text-sm text-muted-foreground md:flex"
      >
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          return (
            <motion.span
              key={crumb.href}
              className="flex items-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              {index > 0 && <ChevronRight className="size-3" />}
              <span className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}>
                {crumb.label}
              </span>
            </motion.span>
          );
        })}
      </nav>

      {/* Right actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {mounted ? (
            <AnimatePresence mode="wait">
              {theme === "dark" ? (
                <motion.div
                  key="moon"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="size-4" />
                </motion.div>
              ) : (
                <motion.div
                  key="sun"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="size-4" />
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <span className="size-4" />
          )}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-6" />

        {/* User info */}
        {user && (
          <div className="flex items-center gap-2">
            {/* Mobile: avatar initials */}
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground sm:hidden">
              {user.username.slice(0, 2).toUpperCase()}
            </div>
            {/* Desktop: full name + role */}
            <span className="hidden text-sm font-medium text-foreground sm:inline">
              {user.username}
            </span>
            <Badge variant="secondary" className="hidden text-xs sm:inline-flex">
              {getRoleLabel(user.role)}
            </Badge>
          </div>
        )}

        {/* Logout */}
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Sign out">
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}
