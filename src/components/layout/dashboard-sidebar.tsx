"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  Link as LinkIcon,
  BarChart3,
  Settings,
  LogOut,
  Users,
  MapPin,
  MessageCircle,
  Wallet,
  DatabaseZap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { ChatDrawer } from "@/components/chat/chat-drawer";
import { openChat } from "@/stores/chat-store";
import { useUnreadCount } from "@/hooks/use-chat";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Categories", href: "/categories", icon: Tags },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Secure Links", href: "/tokens", icon: LinkIcon },
  { name: "Drivers", href: "/drivers", icon: Users },
  { name: "Delivery Map", href: "/delivery-map", icon: MapPin },
  { name: "Payroll", href: "/payroll", icon: Wallet },
  { name: "Statistics", href: "/stats", icon: BarChart3 },
  { name: "Data Mgmt", href: "/data-management", icon: DatabaseZap },
  { name: "Settings", href: "/settings", icon: Settings },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const unreadChat = useUnreadCount();

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Package className="size-4" />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground">TP-Manager</span>
      </div>

      {/* Navigation */}
      <motion.nav
        className="flex-1 space-y-1 px-3 py-4"
        variants={staggerContainer}
        initial="initial"
        animate="animate"
      >
        {navigation.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          return (
            <motion.div key={item.href} variants={fadeUpItem} className="relative">
              <Link
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-primary/10 dark:bg-primary/20"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className="relative size-4 shrink-0" />
                <span className="relative flex-1">{item.name}</span>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      <Separator />

      {/* Chat */}
      <div className="px-3 py-2">
        <button
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={() => openChat()}
        >
          <MessageCircle className="size-4 shrink-0" />
          <span className="flex-1 text-left">Messages</span>
          {unreadChat > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadChat > 9 ? "9+" : unreadChat}
            </span>
          )}
        </button>
      </div>
      <ChatDrawer />

      <Separator />

      {/* Logout */}
      <div className="px-3 py-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="size-4 shrink-0" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
