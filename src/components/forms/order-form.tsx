"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  Clock,
  Check,
  AlertTriangle,
  Package,
  Loader2,
  X,
  Tag,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UNITS, WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { formatQuantityWithUnit, convertUnits } from "@/lib/utils/units";
import { createOrderSchema } from "@/lib/validations/orders";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { PublicItem, TokenGrade, DeliveryFeeTier } from "@/types/database";
import type { Unit } from "@/lib/utils/units";
import { AddressAutocomplete } from "./address-autocomplete";
import { NotificationPrompt } from "./notification-prompt";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface OrderFormProps {
  items: PublicItem[];
  token: string;
  grade: TokenGrade;
  expiresAt: string;
  currencySymbol?: string;
  feeTiers?: DeliveryFeeTier[];
}

const COUNT_UNIT_SET = new Set(["unit", "box", "pack", "tab", "piece"]);

interface CartItem {
  itemId: string;
  name: string;
  variety: string;
  imageUrl: string | null;
  price: number;
  basePrice: number;
  quantity: number;
  unit: Unit;
  stockQuantity: number;
  stockUnit: string;
  pricingTiers: { unit: string; price: number }[];
  lowStockThreshold: number | null;
  promoDiscount: number;
}

function getMaxForUnit(stockQty: number, stockUnit: string, cartUnit: string): number {
  const converted = convertUnits(stockQty, stockUnit, cartUnit);
  return Math.floor(converted);
}

interface SubmitResult {
  order_id?: string;
  delivery_code?: string;
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
}

interface PromoResult {
  valid: boolean;
  promo_code_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  new_total: number;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const REDIRECT_COUNTDOWN_SECONDS = 10;
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  WEED: "Weed",
  WAX: "Wax",
  PHATWOODS: "Phatwoods",
  EDIBLES: "Edibles",
};

// ────────────────────────────────────────────────────────────
// Product Image with fallback
// ────────────────────────────────────────────────────────────

function ProductImage({
  src,
  alt,
  className,
  sizes,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 ${className ?? ""}`}>
        <Package className="size-8 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      className={`object-cover ${className ?? ""}`}
      onError={() => setHasError(true)}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Expiration progress bar
// ────────────────────────────────────────────────────────────

function ExpirationBar({
  timeRemaining,
  totalDuration,
  isWarning,
  formatTime,
}: {
  timeRemaining: number;
  totalDuration: number;
  isWarning: boolean;
  formatTime: (ms: number) => string;
}) {
  const progress = totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 0;

  return (
    <motion.div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
        isWarning
          ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border"
      }`}
      animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
      transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
    >
      {isWarning ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <div className="flex-1 space-y-1">
        <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${isWarning ? "bg-amber-500" : "bg-primary"}`}
            initial={{ width: `${progress}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function OrderForm({
  items,
  token,
  expiresAt,
  currencySymbol = "$",
  feeTiers = [],
}: OrderFormProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<PublicItem | null>(null);

  const totalDuration = useMemo(
    () => Math.max(0, new Date(expiresAt).getTime() - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(totalDuration);

  const categories = useMemo(() => {
    const uniqueTypes = new Set(items.map((item) => item.type?.toUpperCase()).filter(Boolean));
    return Array.from(uniqueTypes).sort();
  }, [items]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    const filtered =
      selectedCategory === "all"
        ? items
        : items.filter((item) => item.type?.toUpperCase() === selectedCategory);
    // Featured items first
    return [...filtered].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });
  }, [items, selectedCategory]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (submitState !== "success") return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitState]);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const isExpired = timeRemaining === 0;
  const isWarning = timeRemaining > 0 && timeRemaining <= WARNING_THRESHOLD_MS;

  const addToCart = useCallback((item: PublicItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        const max = getMaxForUnit(
          item.quantity_available,
          item.unit_measure as string,
          existing.unit,
        );
        if (existing.quantity >= max) return prev;
        return prev.map((c) => (c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      if (item.quantity_available <= 0) return prev;

      const tiers = item.pricing_tiers ?? [];
      const defaultUnit =
        tiers.length > 0 ? (tiers[0].unit as Unit) : (item.unit_measure as Unit) || "g";
      const tier = tiers.find((t) => t.unit === defaultUnit);

      let unitPrice = tier ? tier.price : item.price;
      const discount = Number(item.custom_fields?.promo_discount) || 0;
      const hasPromo = item.badges?.includes("PROMO") && discount > 0;
      if (hasPromo) {
        unitPrice = Math.round(unitPrice * (1 - discount / 100) * 100) / 100;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          variety: item.variety,
          imageUrl: item.image_url ?? null,
          price: unitPrice,
          basePrice: item.price,
          quantity: 1,
          unit: defaultUnit,
          stockQuantity: item.quantity_available,
          stockUnit: (item.unit_measure as string) || "g",
          pricingTiers: tiers,
          lowStockThreshold: item.low_stock_threshold,
          promoDiscount: hasPromo ? discount : 0,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((c) => c.itemId !== itemId);
      return prev.map((c) => (c.itemId === itemId ? { ...c, quantity: c.quantity - 1 } : c));
    });
  }, []);

  const updateCartUnit = useCallback((itemId: string, unit: Unit) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const tier = c.pricingTiers.find((t) => t.unit === unit);
        let price = tier ? tier.price : c.basePrice;
        if (c.promoDiscount > 0) {
          price = Math.round(price * (1 - c.promoDiscount / 100) * 100) / 100;
        }
        return { ...c, unit, price };
      }),
    );
  }, []);

  const updateCartQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return;
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const max = getMaxForUnit(c.stockQuantity, c.stockUnit, c.unit);
        return { ...c, quantity: Math.min(quantity, max) };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // Promo discount applied to the subtotal (recalculate when subtotal changes)
  const promoDiscount = useMemo(() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === "percentage") {
      return Math.round(cartSubtotal * (promoResult.discount_value / 100) * 100) / 100;
    }
    return Math.min(promoResult.discount_value, cartSubtotal);
  }, [promoResult, cartSubtotal]);

  const cartTotal = cartSubtotal - promoDiscount;

  const validatePromoCode = useCallback(async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) return;

    setPromoLoading(true);
    setPromoError(null);
    setPromoResult(null);

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotal: cartSubtotal }),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setPromoError(errBody.error ?? "Invalid promo code");
        return;
      }

      const data = (await res.json()) as PromoResult;
      setPromoResult(data);
      setPromoCode(data.code);
    } catch {
      setPromoError("Failed to validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, cartSubtotal]);

  const removePromoCode = useCallback(() => {
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const handleSubmit = async () => {
    if (isExpired) {
      setSubmitError("This link has expired. You can no longer place an order.");
      setSubmitState("error");
      return;
    }

    if (cart.length === 0) {
      setSubmitError("Please add at least one product to your cart.");
      setSubmitState("error");
      return;
    }

    const orderData = {
      address,
      items: cart.map((c) => ({
        item_id: c.itemId,
        name: c.name,
        variety: c.variety,
        quantity: c.quantity,
        unit: c.unit,
      })),
      notes: notes || null,
      ...(addressCoords && {
        latitude: addressCoords.lat,
        longitude: addressCoords.lng,
      }),
      ...(promoResult && { promo_code: promoResult.code }),
    };

    const validation = createOrderSchema.safeParse(orderData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setSubmitError(firstError?.message ?? "Invalid data");
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tokens/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? "Submission failed");
      }

      const data = (await res.json()) as SubmitResult;
      setSubmitResult(data);
      setSubmitState("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
      setSubmitState("error");
    }
  };

  // ── Success Screen ──
  if (submitState === "success") {
    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
          <motion.div
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Check className="size-8" />
          </motion.div>
          <h2 className="mt-4 text-2xl font-bold">Order Confirmed</h2>
          <p className="mt-1 text-sm text-emerald-100">
            Your order has been submitted successfully
          </p>
        </div>

        <CardContent className="space-y-5 p-6">
          {submitResult?.delivery_code && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delivery Code
              </p>
              <p className="mt-1 text-4xl font-black tracking-[0.25em] tabular-nums">
                {submitResult.delivery_code}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Give this code to the driver upon delivery
              </p>
            </div>
          )}

          {submitResult?.total !== undefined && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.subtotal?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.delivery_fee?.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.total.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {submitResult?.order_id && <NotificationPrompt orderId={submitResult.order_id} />}

          <p className="text-center text-xs text-muted-foreground">
            Do not refresh this page. It will close in {countdown}s
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Expired Screen ──
  if (isExpired && submitState !== "submitting") {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="size-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground">
              This order link has expired. Please request a new one from your supplier.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Place an Order</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Browse our catalog and add products to your cart
          </p>
        </div>

        {/* Compact timer pill — mobile */}
        <motion.div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:hidden ${
            isWarning
              ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border"
          }`}
          animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
          transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
        >
          {isWarning ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
          {formatTime(timeRemaining)}
        </motion.div>

        {/* Full timer bar — desktop */}
        <div className="hidden w-64 shrink-0 sm:block">
          <ExpirationBar
            timeRemaining={timeRemaining}
            totalDuration={totalDuration}
            isWarning={isWarning}
            formatTime={formatTime}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Catalog */}
        <div className="space-y-3 sm:space-y-4 lg:col-span-2">
          {/* Sticky category filters — horizontal scroll on mobile */}
          <div className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedCategory(cat!)}
                >
                  {CATEGORY_LABELS[cat!] ?? cat}
                </Button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Package className="size-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium">No products available</p>
                <p className="text-sm text-muted-foreground">
                  Try a different category or check back later
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.itemId === item.id);
                const isOutOfStock = inCart
                  ? inCart.quantity >=
                    getMaxForUnit(item.quantity_available, item.unit_measure as string, inCart.unit)
                  : item.quantity_available <= 0;
                const isLowStock =
                  !isOutOfStock &&
                  item.low_stock_threshold != null &&
                  item.quantity_available <= item.low_stock_threshold;

                const promoPercent = Number(item.custom_fields?.promo_discount) || 0;
                const hasPromo = item.badges?.includes("PROMO") && promoPercent > 0;
                const discountedPrice = hasPromo
                  ? Math.round(item.price * (1 - promoPercent / 100) * 100) / 100
                  : item.price;

                return (
                  <motion.div key={item.id} variants={fadeUpItem}>
                    <Card
                      className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                        inCart ? "ring-2 ring-primary shadow-md shadow-primary/10" : ""
                      } ${
                        item.is_featured && !inCart
                          ? "ring-1 ring-amber-400/40 shadow-amber-400/10"
                          : ""
                      } ${isOutOfStock && !inCart ? "opacity-50 grayscale-[30%]" : ""}`}
                    >
                      {/* Image */}
                      <div
                        className="relative aspect-square w-full cursor-pointer overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingProduct(item);
                        }}
                      >
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Featured — top left */}
                        {item.is_featured && (
                          <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm sm:left-2 sm:top-2 sm:px-2">
                            FEATURED
                          </span>
                        )}

                        {/* Cart count — top right */}
                        {inCart && (
                          <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg backdrop-blur-sm tabular-nums sm:right-2 sm:top-2 sm:px-2.5 sm:text-xs">
                            <span className="sm:hidden">{inCart.quantity}</span>
                            <span className="hidden sm:inline">{inCart.quantity} in cart</span>
                          </span>
                        )}

                        {/* Badges — bottom of image (max 2 visible on mobile) */}
                        <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1 sm:bottom-2 sm:left-2 sm:flex-wrap">
                          {item.badges?.map((badge) => (
                            <span
                              key={badge}
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm sm:px-2 ${
                                badge === "HOT"
                                  ? "bg-red-500/90 text-white"
                                  : badge === "PROMO"
                                    ? "bg-emerald-500/90 text-white"
                                    : "bg-blue-500/90 text-white"
                              }`}
                            >
                              {badge === "HOT"
                                ? "HOT"
                                : badge === "PROMO"
                                  ? `-${promoPercent}%`
                                  : "NEW"}
                            </span>
                          ))}
                          {isOutOfStock && (
                            <span className="inline-flex items-center rounded-full bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              OUT OF STOCK
                            </span>
                          )}
                          {isLowStock && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              LOW STOCK
                            </span>
                          )}
                        </div>

                        {/* Variety name overlay — desktop only */}
                        <div className="absolute bottom-2 right-2 z-10 hidden max-w-[60%] text-right sm:block">
                          <p className="truncate text-sm font-semibold text-white drop-shadow-md">
                            {item.variety}
                          </p>
                        </div>
                      </div>

                      <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                        {/* Name + type */}
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base">
                            {item.name}
                          </p>
                          {item.type && (
                            <Badge
                              variant="outline"
                              className="mt-1 hidden text-[10px] sm:inline-flex"
                            >
                              {CATEGORY_LABELS[item.type.toUpperCase()] ?? item.type}
                            </Badge>
                          )}
                        </div>

                        {/* Pricing */}
                        {item.price > 0 && (
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            {hasPromo ? (
                              <>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                                  {currencySymbol}
                                  {discountedPrice.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground line-through sm:text-sm">
                                  {currencySymbol}
                                  {Number(item.price).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-bold sm:text-lg">
                                {currencySymbol}
                                {Number(item.price).toFixed(2)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              /{item.unit_measure}
                            </span>
                          </div>
                        )}

                        {/* Stock availability */}
                        <p
                          className={`text-[11px] font-medium ${
                            isOutOfStock
                              ? "text-destructive"
                              : isLowStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {isOutOfStock
                            ? "Out of stock"
                            : `${formatQuantityWithUnit(item.quantity_available, item.unit_measure as string)} available`}
                        </p>

                        {/* Action — inline stepper when in cart */}
                        <AnimatePresence mode="wait">
                          {isOutOfStock ? (
                            <motion.div
                              key="oos"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button className="w-full" size="sm" variant="outline" disabled>
                                <span className="hidden sm:inline">Out of Stock</span>
                                <span className="text-xs sm:hidden">Sold Out</span>
                              </Button>
                            </motion.div>
                          ) : inCart ? (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center justify-center gap-0.5 rounded-lg border"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Minus className="size-4 sm:size-3.5" />
                              </Button>
                              <span className="w-8 text-center text-sm font-bold tabular-nums">
                                {inCart.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                disabled={
                                  inCart.quantity >=
                                  getMaxForUnit(
                                    item.quantity_available,
                                    item.unit_measure as string,
                                    inCart.unit,
                                  )
                                }
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4 sm:size-3.5" />
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="add"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button
                                className="h-9 w-full sm:h-8"
                                size="sm"
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">Add to Cart</span>
                                <span className="sm:hidden">Add</span>
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Cart Sidebar — desktop only */}
        <div className="hidden space-y-4 lg:block">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart
                  {cartItemCount > 0 && <Badge variant="secondary">{cartItemCount}</Badge>}
                </CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <ShoppingCart className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground">Add products from the catalog</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((cartItem) => (
                    <motion.div
                      key={cartItem.itemId}
                      className="space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Cart item thumbnail */}
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          <ProductImage src={cartItem.imageUrl} alt={cartItem.name} sizes="40px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cartItem.name}</p>
                          <p className="text-xs text-muted-foreground">{cartItem.variety}</p>
                        </div>
                        {cartItem.price > 0 && (
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {currencySymbol}
                            {(cartItem.price * cartItem.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => removeFromCart(cartItem.itemId)}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={cartItem.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                updateCartQuantity(cartItem.itemId, val);
                              }
                            }}
                            className="h-8 w-12 border-0 p-0 text-center text-xs shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              cartItem.quantity >=
                              getMaxForUnit(
                                cartItem.stockQuantity,
                                cartItem.stockUnit,
                                cartItem.unit,
                              )
                            }
                            onClick={() => {
                              const original = items.find((i) => i.id === cartItem.itemId);
                              if (original) addToCart(original);
                            }}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>

                        {(() => {
                          const tierUnits =
                            cartItem.pricingTiers.length > 0
                              ? cartItem.pricingTiers.map((t) => {
                                  const existing = UNITS.find((u) => u.value === t.unit);
                                  return existing ?? { value: t.unit as Unit, label: t.unit };
                                })
                              : null;
                          const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                            ? COUNT_UNITS
                            : WEIGHT_UNITS;
                          const unitList = tierUnits ?? fallbackUnits;
                          return (
                            <Select
                              value={cartItem.unit}
                              onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                            >
                              <SelectTrigger className="h-6 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {unitList.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatQuantityWithUnit(cartItem.quantity, cartItem.unit)}</span>
                        {cartItem.price > 0 && (
                          <span className="tabular-nums">
                            {currencySymbol}
                            {cartItem.price.toFixed(2)}/{cartItem.unit}
                          </span>
                        )}
                      </div>

                      <Separator />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {cart.length > 0 && cartSubtotal > 0 && (
                <div className="space-y-1 pt-2 text-sm">
                  <Separator />
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {currencySymbol}
                      {cartSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {promoResult && promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums">
                        -{currencySymbol}
                        {promoDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {feeTiers.length > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Delivery fee</span>
                      <span>Calculated at checkout</span>
                    </div>
                  )}
                  {promoResult && promoDiscount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between pt-1 text-base font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {currencySymbol}
                          {cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Promo Code */}
          {cart.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="size-4" />
                  Promo Code
                </div>

                {promoResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} applied
                        {" -- "}
                        {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {promoResult.discount_type === "percentage"
                          ? `${promoResult.discount_value}% discount`
                          : `${currencySymbol}${promoResult.discount_value.toFixed(2)} flat discount`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={removePromoCode}
                    >
                      <X className="size-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        if (promoError) setPromoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          validatePromoCode();
                        }
                      }}
                      className="h-9 flex-1 uppercase"
                      disabled={promoLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={!promoCode.trim() || promoLoading}
                      onClick={validatePromoCode}
                    >
                      {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}

                <AnimatePresence>
                  {promoError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-destructive"
                    >
                      {promoError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddressAutocomplete
                value={address}
                onChange={(addr, coords) => {
                  setAddress(addr);
                  if (coords) setAddressCoords(coords);
                }}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            className="w-full text-base font-semibold"
            size="lg"
            disabled={
              cart.length === 0 || !address.trim() || submitState === "submitting" || isExpired
            }
            onClick={handleSubmit}
          >
            {submitState === "submitting" ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <ShoppingCart className="size-5" />
                Submit Order
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {cartItemCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Spacer for fixed mobile cart bar */}
      {cart.length > 0 && <div className="h-16 lg:hidden" />}

      {/* Mobile cart bar — visible only below lg */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <Button className="h-12 w-full text-base" size="lg">
                <ShoppingCart className="size-5" />
                <span>
                  {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                </span>
                <span className="mx-1 text-muted-foreground/60">·</span>
                <span className="font-bold tabular-nums">
                  {currencySymbol}
                  {cartTotal.toFixed(2)}
                </span>
                <span className="ml-auto">View Cart</span>
                <ChevronUp className="ml-1 size-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="flex max-h-[85dvh] flex-col">
              <DrawerHeader className="flex shrink-0 flex-row items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart ({cartItemCount})
                </DrawerTitle>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              </DrawerHeader>

              {/* Scrollable content */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4">
                {/* Cart items */}
                <div className="space-y-3">
                  {cart.map((cartItem) => {
                    const tierUnits =
                      cartItem.pricingTiers.length > 0
                        ? cartItem.pricingTiers.map((t) => {
                            const existing = UNITS.find((u) => u.value === t.unit);
                            return existing ?? { value: t.unit as Unit, label: t.unit };
                          })
                        : null;
                    const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                      ? COUNT_UNITS
                      : WEIGHT_UNITS;
                    const unitList = tierUnits ?? fallbackUnits;

                    return (
                      <div key={cartItem.itemId} className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <ProductImage
                              src={cartItem.imageUrl}
                              alt={cartItem.name}
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-medium">{cartItem.name}</p>
                            <p className="text-sm text-muted-foreground">{cartItem.variety}</p>
                          </div>
                          {cartItem.price > 0 && (
                            <span className="shrink-0 text-base font-semibold tabular-nums">
                              {currencySymbol}
                              {(cartItem.price * cartItem.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center rounded-lg border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => removeFromCart(cartItem.itemId)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-10 text-center text-sm font-medium tabular-nums">
                              {cartItem.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={
                                cartItem.quantity >=
                                getMaxForUnit(
                                  cartItem.stockQuantity,
                                  cartItem.stockUnit,
                                  cartItem.unit,
                                )
                              }
                              onClick={() => {
                                const original = items.find((i) => i.id === cartItem.itemId);
                                if (original) addToCart(original);
                              }}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>

                          <Select
                            value={cartItem.unit}
                            onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                          >
                            <SelectTrigger className="h-9 w-24 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {unitList.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {cartItem.price > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {currencySymbol}
                              {cartItem.price.toFixed(2)}/{cartItem.unit}
                            </span>
                          )}
                        </div>

                        <Separator />
                      </div>
                    );
                  })}
                </div>

                {/* Promo code */}
                <div className="space-y-2.5">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <Tag className="size-4" />
                    Promo Code
                  </p>
                  {promoResult ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} &mdash; {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={removePromoCode}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          if (promoError) setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            validatePromoCode();
                          }
                        }}
                        className="h-9 flex-1 uppercase"
                        disabled={promoLoading}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        disabled={!promoCode.trim() || promoLoading}
                        onClick={validatePromoCode}
                      >
                        {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                  {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                </div>

                <Separator />

                {/* Address + Notes */}
                <div className="space-y-3 pb-4">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <MapPin className="size-4" />
                    Delivery Address
                  </p>
                  <AddressAutocomplete
                    value={address}
                    onChange={(addr, coords) => {
                      setAddress(addr);
                      if (coords) setAddressCoords(coords);
                    }}
                  />
                  <Textarea
                    placeholder="Delivery notes (optional)"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none text-base"
                  />
                </div>
              </div>

              {/* Sticky footer — always visible */}
              <div className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {cartSubtotal > 0 && (
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium tabular-nums">
                        {currencySymbol}
                        {cartSubtotal.toFixed(2)}
                      </span>
                    </div>
                    {promoResult && promoDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-medium tabular-nums">
                          -{currencySymbol}
                          {promoDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {feeTiers.length > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Delivery fee</span>
                        <span>Calculated at checkout</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between pt-1 text-base font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {currencySymbol}
                        {cartTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <Button
                  className="h-12 w-full text-base font-semibold"
                  size="lg"
                  disabled={
                    cart.length === 0 ||
                    !address.trim() ||
                    submitState === "submitting" ||
                    isExpired
                  }
                  onClick={handleSubmit}
                >
                  {submitState === "submitting" ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-5" />
                      Submit Order
                    </>
                  )}
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog
        open={viewingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setViewingProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingProduct.variety}</DialogTitle>
                <DialogDescription>
                  {viewingProduct.name}
                  {viewingProduct.type &&
                    ` — ${CATEGORY_LABELS[viewingProduct.type.toUpperCase()] ?? viewingProduct.type}`}
                </DialogDescription>
              </DialogHeader>

              {viewingProduct.image_url && (
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                  <Image
                    src={viewingProduct.image_url}
                    alt={viewingProduct.variety}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 400px"
                  />
                </div>
              )}

              <div className="space-y-3">
                {/* Badges */}
                {viewingProduct.badges && viewingProduct.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingProduct.is_featured && (
                      <Badge className="bg-amber-500/90 text-white">FEATURED</Badge>
                    )}
                    {viewingProduct.badges.map((badge) => (
                      <Badge
                        key={badge}
                        className={
                          badge === "HOT"
                            ? "bg-red-500/90 text-white"
                            : badge === "PROMO"
                              ? "bg-emerald-500/90 text-white"
                              : "bg-blue-500/90 text-white"
                        }
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Price */}
                {viewingProduct.price > 0 && (
                  <div className="flex items-baseline gap-2">
                    {(() => {
                      const promoPercent =
                        Number(viewingProduct.custom_fields?.promo_discount) || 0;
                      const hasPromo = viewingProduct.badges?.includes("PROMO") && promoPercent > 0;
                      const discounted = hasPromo
                        ? Math.round(viewingProduct.price * (1 - promoPercent / 100) * 100) / 100
                        : viewingProduct.price;
                      return hasPromo ? (
                        <>
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol}
                            {discounted.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {currencySymbol}
                            {Number(viewingProduct.price).toFixed(2)}
                          </span>
                          <Badge className="bg-emerald-500/90 text-white">-{promoPercent}%</Badge>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">
                          {currencySymbol}
                          {Number(viewingProduct.price).toFixed(2)}
                        </span>
                      );
                    })()}
                    <span className="text-sm text-muted-foreground">
                      /{viewingProduct.unit_measure}
                    </span>
                  </div>
                )}

                {/* Stock */}
                <p className="text-sm text-muted-foreground">
                  {viewingProduct.quantity_available > 0
                    ? `${viewingProduct.quantity_available} ${viewingProduct.unit_measure} available`
                    : "Out of stock"}
                </p>

                {/* Pricing tiers */}
                {viewingProduct.pricing_tiers && viewingProduct.pricing_tiers.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Available quantities:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingProduct.pricing_tiers.map((tier) => (
                        <Badge key={tier.unit} variant="outline" className="tabular-nums">
                          {tier.unit} — {currencySymbol}
                          {tier.price.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const inDialogCart = cart.find((c) => c.itemId === viewingProduct.id);
                return inDialogCart ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border p-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => removeFromCart(viewingProduct.id)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-12 text-center text-lg font-bold tabular-nums">
                      {inDialogCart.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      disabled={
                        inDialogCart.quantity >=
                        getMaxForUnit(
                          viewingProduct.quantity_available,
                          viewingProduct.unit_measure as string,
                          inDialogCart.unit,
                        )
                      }
                      onClick={() => addToCart(viewingProduct)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={viewingProduct.quantity_available <= 0}
                    onClick={() => addToCart(viewingProduct)}
                  >
                    <Plus className="size-4" />
                    Add to Cart
                  </Button>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  Clock,
  Check,
  AlertTriangle,
  Package,
  Loader2,
  X,
  Tag,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UNITS, WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { formatQuantityWithUnit, convertUnits } from "@/lib/utils/units";
import { createOrderSchema } from "@/lib/validations/orders";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { PublicItem, TokenGrade, DeliveryFeeTier } from "@/types/database";
import type { Unit } from "@/lib/utils/units";
import { AddressAutocomplete } from "./address-autocomplete";
import { NotificationPrompt } from "./notification-prompt";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface OrderFormProps {
  items: PublicItem[];
  token: string;
  grade: TokenGrade;
  expiresAt: string;
  currencySymbol?: string;
  feeTiers?: DeliveryFeeTier[];
}

const COUNT_UNIT_SET = new Set(["unit", "box", "pack", "tab", "piece"]);

interface CartItem {
  itemId: string;
  name: string;
  variety: string;
  imageUrl: string | null;
  price: number;
  basePrice: number;
  quantity: number;
  unit: Unit;
  stockQuantity: number;
  stockUnit: string;
  pricingTiers: { unit: string; price: number }[];
  lowStockThreshold: number | null;
  promoDiscount: number;
}

function getMaxForUnit(stockQty: number, stockUnit: string, cartUnit: string): number {
  const converted = convertUnits(stockQty, stockUnit, cartUnit);
  return Math.floor(converted);
}

interface SubmitResult {
  order_id?: string;
  delivery_code?: string;
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
}

interface PromoResult {
  valid: boolean;
  promo_code_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  new_total: number;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const REDIRECT_COUNTDOWN_SECONDS = 10;
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  WEED: "Weed",
  WAX: "Wax",
  PHATWOODS: "Phatwoods",
  EDIBLES: "Edibles",
};

// ────────────────────────────────────────────────────────────
// Product Image with fallback
// ────────────────────────────────────────────────────────────

function ProductImage({
  src,
  alt,
  className,
  sizes,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 ${className ?? ""}`}>
        <Package className="size-8 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      className={`object-cover ${className ?? ""}`}
      onError={() => setHasError(true)}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Expiration progress bar
// ────────────────────────────────────────────────────────────

function ExpirationBar({
  timeRemaining,
  totalDuration,
  isWarning,
  formatTime,
}: {
  timeRemaining: number;
  totalDuration: number;
  isWarning: boolean;
  formatTime: (ms: number) => string;
}) {
  const progress = totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 0;

  return (
    <motion.div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
        isWarning
          ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border"
      }`}
      animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
      transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
    >
      {isWarning ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <div className="flex-1 space-y-1">
        <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${isWarning ? "bg-amber-500" : "bg-primary"}`}
            initial={{ width: `${progress}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function OrderForm({
  items,
  token,
  expiresAt,
  currencySymbol = "$",
  feeTiers = [],
}: OrderFormProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<PublicItem | null>(null);

  const totalDuration = useMemo(
    () => Math.max(0, new Date(expiresAt).getTime() - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(totalDuration);

  const categories = useMemo(() => {
    const uniqueTypes = new Set(items.map((item) => item.type?.toUpperCase()).filter(Boolean));
    return Array.from(uniqueTypes).sort();
  }, [items]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    const filtered =
      selectedCategory === "all"
        ? items
        : items.filter((item) => item.type?.toUpperCase() === selectedCategory);
    // Featured items first
    return [...filtered].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });
  }, [items, selectedCategory]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (submitState !== "success") return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitState]);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const isExpired = timeRemaining === 0;
  const isWarning = timeRemaining > 0 && timeRemaining <= WARNING_THRESHOLD_MS;

  const addToCart = useCallback((item: PublicItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        const max = getMaxForUnit(
          item.quantity_available,
          item.unit_measure as string,
          existing.unit,
        );
        if (existing.quantity >= max) return prev;
        return prev.map((c) => (c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      if (item.quantity_available <= 0) return prev;

      const tiers = item.pricing_tiers ?? [];
      const defaultUnit =
        tiers.length > 0 ? (tiers[0].unit as Unit) : (item.unit_measure as Unit) || "g";
      const tier = tiers.find((t) => t.unit === defaultUnit);

      let unitPrice = tier ? tier.price : item.price;
      const discount = Number(item.custom_fields?.promo_discount) || 0;
      const hasPromo = item.badges?.includes("PROMO") && discount > 0;
      if (hasPromo) {
        unitPrice = Math.round(unitPrice * (1 - discount / 100) * 100) / 100;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          variety: item.variety,
          imageUrl: item.image_url ?? null,
          price: unitPrice,
          basePrice: item.price,
          quantity: 1,
          unit: defaultUnit,
          stockQuantity: item.quantity_available,
          stockUnit: (item.unit_measure as string) || "g",
          pricingTiers: tiers,
          lowStockThreshold: item.low_stock_threshold,
          promoDiscount: hasPromo ? discount : 0,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((c) => c.itemId !== itemId);
      return prev.map((c) => (c.itemId === itemId ? { ...c, quantity: c.quantity - 1 } : c));
    });
  }, []);

  const updateCartUnit = useCallback((itemId: string, unit: Unit) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const tier = c.pricingTiers.find((t) => t.unit === unit);
        let price = tier ? tier.price : c.basePrice;
        if (c.promoDiscount > 0) {
          price = Math.round(price * (1 - c.promoDiscount / 100) * 100) / 100;
        }
        return { ...c, unit, price };
      }),
    );
  }, []);

  const updateCartQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return;
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const max = getMaxForUnit(c.stockQuantity, c.stockUnit, c.unit);
        return { ...c, quantity: Math.min(quantity, max) };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // Promo discount applied to the subtotal (recalculate when subtotal changes)
  const promoDiscount = useMemo(() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === "percentage") {
      return Math.round(cartSubtotal * (promoResult.discount_value / 100) * 100) / 100;
    }
    return Math.min(promoResult.discount_value, cartSubtotal);
  }, [promoResult, cartSubtotal]);

  const cartTotal = cartSubtotal - promoDiscount;

  const validatePromoCode = useCallback(async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) return;

    setPromoLoading(true);
    setPromoError(null);
    setPromoResult(null);

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotal: cartSubtotal }),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setPromoError(errBody.error ?? "Invalid promo code");
        return;
      }

      const data = (await res.json()) as PromoResult;
      setPromoResult(data);
      setPromoCode(data.code);
    } catch {
      setPromoError("Failed to validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, cartSubtotal]);

  const removePromoCode = useCallback(() => {
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const handleSubmit = async () => {
    if (isExpired) {
      setSubmitError("This link has expired. You can no longer place an order.");
      setSubmitState("error");
      return;
    }

    if (cart.length === 0) {
      setSubmitError("Please add at least one product to your cart.");
      setSubmitState("error");
      return;
    }

    const orderData = {
      address,
      items: cart.map((c) => ({
        item_id: c.itemId,
        name: c.name,
        variety: c.variety,
        quantity: c.quantity,
        unit: c.unit,
      })),
      notes: notes || null,
      ...(addressCoords && {
        latitude: addressCoords.lat,
        longitude: addressCoords.lng,
      }),
      ...(promoResult && { promo_code: promoResult.code }),
    };

    const validation = createOrderSchema.safeParse(orderData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setSubmitError(firstError?.message ?? "Invalid data");
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tokens/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? "Submission failed");
      }

      const data = (await res.json()) as SubmitResult;
      setSubmitResult(data);
      setSubmitState("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
      setSubmitState("error");
    }
  };

  // ── Success Screen ──
  if (submitState === "success") {
    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
          <motion.div
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Check className="size-8" />
          </motion.div>
          <h2 className="mt-4 text-2xl font-bold">Order Confirmed</h2>
          <p className="mt-1 text-sm text-emerald-100">
            Your order has been submitted successfully
          </p>
        </div>

        <CardContent className="space-y-5 p-6">
          {submitResult?.delivery_code && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delivery Code
              </p>
              <p className="mt-1 text-4xl font-black tracking-[0.25em] tabular-nums">
                {submitResult.delivery_code}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Give this code to the driver upon delivery
              </p>
            </div>
          )}

          {submitResult?.total !== undefined && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.subtotal?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.delivery_fee?.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.total.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {submitResult?.order_id && <NotificationPrompt orderId={submitResult.order_id} />}

          <p className="text-center text-xs text-muted-foreground">
            Do not refresh this page. It will close in {countdown}s
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Expired Screen ──
  if (isExpired && submitState !== "submitting") {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="size-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground">
              This order link has expired. Please request a new one from your supplier.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Place an Order</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Browse our catalog and add products to your cart
          </p>
        </div>

        {/* Compact timer pill — mobile */}
        <motion.div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:hidden ${
            isWarning
              ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border"
          }`}
          animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
          transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
        >
          {isWarning ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
          {formatTime(timeRemaining)}
        </motion.div>

        {/* Full timer bar — desktop */}
        <div className="hidden w-64 shrink-0 sm:block">
          <ExpirationBar
            timeRemaining={timeRemaining}
            totalDuration={totalDuration}
            isWarning={isWarning}
            formatTime={formatTime}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Catalog */}
        <div className="space-y-3 sm:space-y-4 lg:col-span-2">
          {/* Sticky category filters — horizontal scroll on mobile */}
          <div className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedCategory(cat!)}
                >
                  {CATEGORY_LABELS[cat!] ?? cat}
                </Button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Package className="size-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium">No products available</p>
                <p className="text-sm text-muted-foreground">
                  Try a different category or check back later
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.itemId === item.id);
                const isOutOfStock = inCart
                  ? inCart.quantity >=
                    getMaxForUnit(item.quantity_available, item.unit_measure as string, inCart.unit)
                  : item.quantity_available <= 0;
                const isLowStock =
                  !isOutOfStock &&
                  item.low_stock_threshold != null &&
                  item.quantity_available <= item.low_stock_threshold;

                const promoPercent = Number(item.custom_fields?.promo_discount) || 0;
                const hasPromo = item.badges?.includes("PROMO") && promoPercent > 0;
                const discountedPrice = hasPromo
                  ? Math.round(item.price * (1 - promoPercent / 100) * 100) / 100
                  : item.price;

                return (
                  <motion.div key={item.id} variants={fadeUpItem}>
                    <Card
                      className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                        inCart ? "ring-2 ring-primary shadow-md shadow-primary/10" : ""
                      } ${
                        item.is_featured && !inCart
                          ? "ring-1 ring-amber-400/40 shadow-amber-400/10"
                          : ""
                      } ${isOutOfStock && !inCart ? "opacity-50 grayscale-[30%]" : ""}`}
                    >
                      {/* Image */}
                      <div
                        className="relative aspect-square w-full cursor-pointer overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingProduct(item);
                        }}
                      >
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Featured — top left */}
                        {item.is_featured && (
                          <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm sm:left-2 sm:top-2 sm:px-2">
                            FEATURED
                          </span>
                        )}

                        {/* Cart count — top right */}
                        {inCart && (
                          <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg backdrop-blur-sm tabular-nums sm:right-2 sm:top-2 sm:px-2.5 sm:text-xs">
                            <span className="sm:hidden">{inCart.quantity}</span>
                            <span className="hidden sm:inline">{inCart.quantity} in cart</span>
                          </span>
                        )}

                        {/* Badges — bottom of image (max 2 visible on mobile) */}
                        <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1 sm:bottom-2 sm:left-2 sm:flex-wrap">
                          {item.badges?.map((badge) => (
                            <span
                              key={badge}
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm sm:px-2 ${
                                badge === "HOT"
                                  ? "bg-red-500/90 text-white"
                                  : badge === "PROMO"
                                    ? "bg-emerald-500/90 text-white"
                                    : "bg-blue-500/90 text-white"
                              }`}
                            >
                              {badge === "HOT"
                                ? "HOT"
                                : badge === "PROMO"
                                  ? `-${promoPercent}%`
                                  : "NEW"}
                            </span>
                          ))}
                          {isOutOfStock && (
                            <span className="inline-flex items-center rounded-full bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              OUT OF STOCK
                            </span>
                          )}
                          {isLowStock && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              LOW STOCK
                            </span>
                          )}
                        </div>

                        {/* Variety name overlay — desktop only */}
                        <div className="absolute bottom-2 right-2 z-10 hidden max-w-[60%] text-right sm:block">
                          <p className="truncate text-sm font-semibold text-white drop-shadow-md">
                            {item.variety}
                          </p>
                        </div>
                      </div>

                      <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                        {/* Name + type */}
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base">
                            {item.name}
                          </p>
                          {item.type && (
                            <Badge
                              variant="outline"
                              className="mt-1 hidden text-[10px] sm:inline-flex"
                            >
                              {CATEGORY_LABELS[item.type.toUpperCase()] ?? item.type}
                            </Badge>
                          )}
                        </div>

                        {/* Pricing */}
                        {item.price > 0 && (
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            {hasPromo ? (
                              <>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                                  {currencySymbol}
                                  {discountedPrice.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground line-through sm:text-sm">
                                  {currencySymbol}
                                  {Number(item.price).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-bold sm:text-lg">
                                {currencySymbol}
                                {Number(item.price).toFixed(2)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              /{item.unit_measure}
                            </span>
                          </div>
                        )}

                        {/* Stock availability */}
                        <p
                          className={`text-[11px] font-medium ${
                            isOutOfStock
                              ? "text-destructive"
                              : isLowStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {isOutOfStock
                            ? "Out of stock"
                            : `${formatQuantityWithUnit(item.quantity_available, item.unit_measure as string)} available`}
                        </p>

                        {/* Action — inline stepper when in cart */}
                        <AnimatePresence mode="wait">
                          {isOutOfStock ? (
                            <motion.div
                              key="oos"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button className="w-full" size="sm" variant="outline" disabled>
                                <span className="hidden sm:inline">Out of Stock</span>
                                <span className="text-xs sm:hidden">Sold Out</span>
                              </Button>
                            </motion.div>
                          ) : inCart ? (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center justify-center gap-0.5 rounded-lg border"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Minus className="size-4 sm:size-3.5" />
                              </Button>
                              <span className="w-8 text-center text-sm font-bold tabular-nums">
                                {inCart.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                disabled={
                                  inCart.quantity >=
                                  getMaxForUnit(
                                    item.quantity_available,
                                    item.unit_measure as string,
                                    inCart.unit,
                                  )
                                }
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4 sm:size-3.5" />
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="add"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button
                                className="h-9 w-full sm:h-8"
                                size="sm"
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">Add to Cart</span>
                                <span className="sm:hidden">Add</span>
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Cart Sidebar — desktop only */}
        <div className="hidden space-y-4 lg:block">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart
                  {cartItemCount > 0 && <Badge variant="secondary">{cartItemCount}</Badge>}
                </CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <ShoppingCart className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground">Add products from the catalog</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((cartItem) => (
                    <motion.div
                      key={cartItem.itemId}
                      className="space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Cart item thumbnail */}
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          <ProductImage src={cartItem.imageUrl} alt={cartItem.name} sizes="40px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cartItem.name}</p>
                          <p className="text-xs text-muted-foreground">{cartItem.variety}</p>
                        </div>
                        {cartItem.price > 0 && (
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {currencySymbol}
                            {(cartItem.price * cartItem.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => removeFromCart(cartItem.itemId)}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={cartItem.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                updateCartQuantity(cartItem.itemId, val);
                              }
                            }}
                            className="h-8 w-12 border-0 p-0 text-center text-xs shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              cartItem.quantity >=
                              getMaxForUnit(
                                cartItem.stockQuantity,
                                cartItem.stockUnit,
                                cartItem.unit,
                              )
                            }
                            onClick={() => {
                              const original = items.find((i) => i.id === cartItem.itemId);
                              if (original) addToCart(original);
                            }}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>

                        {(() => {
                          const tierUnits =
                            cartItem.pricingTiers.length > 0
                              ? cartItem.pricingTiers.map((t) => {
                                  const existing = UNITS.find((u) => u.value === t.unit);
                                  return existing ?? { value: t.unit as Unit, label: t.unit };
                                })
                              : null;
                          const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                            ? COUNT_UNITS
                            : WEIGHT_UNITS;
                          const unitList = tierUnits ?? fallbackUnits;
                          return (
                            <Select
                              value={cartItem.unit}
                              onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                            >
                              <SelectTrigger className="h-6 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {unitList.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatQuantityWithUnit(cartItem.quantity, cartItem.unit)}</span>
                        {cartItem.price > 0 && (
                          <span className="tabular-nums">
                            {currencySymbol}
                            {cartItem.price.toFixed(2)}/{cartItem.unit}
                          </span>
                        )}
                      </div>

                      <Separator />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {cart.length > 0 && cartSubtotal > 0 && (
                <div className="space-y-1 pt-2 text-sm">
                  <Separator />
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {currencySymbol}
                      {cartSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {promoResult && promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums">
                        -{currencySymbol}
                        {promoDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {feeTiers.length > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Delivery fee</span>
                      <span>Calculated at checkout</span>
                    </div>
                  )}
                  {promoResult && promoDiscount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between pt-1 text-base font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {currencySymbol}
                          {cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Promo Code */}
          {cart.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="size-4" />
                  Promo Code
                </div>

                {promoResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} applied
                        {" -- "}
                        {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {promoResult.discount_type === "percentage"
                          ? `${promoResult.discount_value}% discount`
                          : `${currencySymbol}${promoResult.discount_value.toFixed(2)} flat discount`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={removePromoCode}
                    >
                      <X className="size-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        if (promoError) setPromoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          validatePromoCode();
                        }
                      }}
                      className="h-9 flex-1 uppercase"
                      disabled={promoLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={!promoCode.trim() || promoLoading}
                      onClick={validatePromoCode}
                    >
                      {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}

                <AnimatePresence>
                  {promoError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-destructive"
                    >
                      {promoError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddressAutocomplete
                value={address}
                onChange={(addr, coords) => {
                  setAddress(addr);
                  if (coords) setAddressCoords(coords);
                }}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            className="w-full text-base font-semibold"
            size="lg"
            disabled={
              cart.length === 0 || !address.trim() || submitState === "submitting" || isExpired
            }
            onClick={handleSubmit}
          >
            {submitState === "submitting" ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <ShoppingCart className="size-5" />
                Submit Order
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {cartItemCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Spacer for fixed mobile cart bar */}
      {cart.length > 0 && <div className="h-16 lg:hidden" />}

      {/* Mobile cart bar — visible only below lg */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <Button className="h-12 w-full text-base" size="lg">
                <ShoppingCart className="size-5" />
                <span>
                  {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                </span>
                <span className="mx-1 text-muted-foreground/60">·</span>
                <span className="font-bold tabular-nums">
                  {currencySymbol}
                  {cartTotal.toFixed(2)}
                </span>
                <span className="ml-auto">View Cart</span>
                <ChevronUp className="ml-1 size-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="flex max-h-[85dvh] flex-col">
              <DrawerHeader className="flex shrink-0 flex-row items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart ({cartItemCount})
                </DrawerTitle>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              </DrawerHeader>

              {/* Scrollable content */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4">
                {/* Cart items */}
                <div className="space-y-3">
                  {cart.map((cartItem) => {
                    const tierUnits =
                      cartItem.pricingTiers.length > 0
                        ? cartItem.pricingTiers.map((t) => {
                            const existing = UNITS.find((u) => u.value === t.unit);
                            return existing ?? { value: t.unit as Unit, label: t.unit };
                          })
                        : null;
                    const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                      ? COUNT_UNITS
                      : WEIGHT_UNITS;
                    const unitList = tierUnits ?? fallbackUnits;

                    return (
                      <div key={cartItem.itemId} className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <ProductImage
                              src={cartItem.imageUrl}
                              alt={cartItem.name}
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-medium">{cartItem.name}</p>
                            <p className="text-sm text-muted-foreground">{cartItem.variety}</p>
                          </div>
                          {cartItem.price > 0 && (
                            <span className="shrink-0 text-base font-semibold tabular-nums">
                              {currencySymbol}
                              {(cartItem.price * cartItem.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center rounded-lg border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => removeFromCart(cartItem.itemId)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-10 text-center text-sm font-medium tabular-nums">
                              {cartItem.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={
                                cartItem.quantity >=
                                getMaxForUnit(
                                  cartItem.stockQuantity,
                                  cartItem.stockUnit,
                                  cartItem.unit,
                                )
                              }
                              onClick={() => {
                                const original = items.find((i) => i.id === cartItem.itemId);
                                if (original) addToCart(original);
                              }}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>

                          <Select
                            value={cartItem.unit}
                            onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                          >
                            <SelectTrigger className="h-9 w-24 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {unitList.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {cartItem.price > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {currencySymbol}
                              {cartItem.price.toFixed(2)}/{cartItem.unit}
                            </span>
                          )}
                        </div>

                        <Separator />
                      </div>
                    );
                  })}
                </div>

                {/* Promo code */}
                <div className="space-y-2.5">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <Tag className="size-4" />
                    Promo Code
                  </p>
                  {promoResult ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} &mdash; {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={removePromoCode}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          if (promoError) setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            validatePromoCode();
                          }
                        }}
                        className="h-9 flex-1 uppercase"
                        disabled={promoLoading}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        disabled={!promoCode.trim() || promoLoading}
                        onClick={validatePromoCode}
                      >
                        {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                  {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                </div>

                <Separator />

                {/* Address + Notes */}
                <div className="space-y-3 pb-4">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <MapPin className="size-4" />
                    Delivery Address
                  </p>
                  <AddressAutocomplete
                    value={address}
                    onChange={(addr, coords) => {
                      setAddress(addr);
                      if (coords) setAddressCoords(coords);
                    }}
                  />
                  <Textarea
                    placeholder="Delivery notes (optional)"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none text-base"
                  />
                </div>
              </div>

              {/* Sticky footer — always visible */}
              <div className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {cartSubtotal > 0 && (
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium tabular-nums">
                        {currencySymbol}
                        {cartSubtotal.toFixed(2)}
                      </span>
                    </div>
                    {promoResult && promoDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-medium tabular-nums">
                          -{currencySymbol}
                          {promoDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {feeTiers.length > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Delivery fee</span>
                        <span>Calculated at checkout</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between pt-1 text-base font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {currencySymbol}
                        {cartTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <Button
                  className="h-12 w-full text-base font-semibold"
                  size="lg"
                  disabled={
                    cart.length === 0 ||
                    !address.trim() ||
                    submitState === "submitting" ||
                    isExpired
                  }
                  onClick={handleSubmit}
                >
                  {submitState === "submitting" ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-5" />
                      Submit Order
                    </>
                  )}
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog
        open={viewingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setViewingProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingProduct.variety}</DialogTitle>
                <DialogDescription>
                  {viewingProduct.name}
                  {viewingProduct.type &&
                    ` — ${CATEGORY_LABELS[viewingProduct.type.toUpperCase()] ?? viewingProduct.type}`}
                </DialogDescription>
              </DialogHeader>

              {viewingProduct.image_url && (
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                  <Image
                    src={viewingProduct.image_url}
                    alt={viewingProduct.variety}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 400px"
                  />
                </div>
              )}

              <div className="space-y-3">
                {/* Badges */}
                {viewingProduct.badges && viewingProduct.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingProduct.is_featured && (
                      <Badge className="bg-amber-500/90 text-white">FEATURED</Badge>
                    )}
                    {viewingProduct.badges.map((badge) => (
                      <Badge
                        key={badge}
                        className={
                          badge === "HOT"
                            ? "bg-red-500/90 text-white"
                            : badge === "PROMO"
                              ? "bg-emerald-500/90 text-white"
                              : "bg-blue-500/90 text-white"
                        }
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Price */}
                {viewingProduct.price > 0 && (
                  <div className="flex items-baseline gap-2">
                    {(() => {
                      const promoPercent =
                        Number(viewingProduct.custom_fields?.promo_discount) || 0;
                      const hasPromo = viewingProduct.badges?.includes("PROMO") && promoPercent > 0;
                      const discounted = hasPromo
                        ? Math.round(viewingProduct.price * (1 - promoPercent / 100) * 100) / 100
                        : viewingProduct.price;
                      return hasPromo ? (
                        <>
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol}
                            {discounted.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {currencySymbol}
                            {Number(viewingProduct.price).toFixed(2)}
                          </span>
                          <Badge className="bg-emerald-500/90 text-white">-{promoPercent}%</Badge>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">
                          {currencySymbol}
                          {Number(viewingProduct.price).toFixed(2)}
                        </span>
                      );
                    })()}
                    <span className="text-sm text-muted-foreground">
                      /{viewingProduct.unit_measure}
                    </span>
                  </div>
                )}

                {/* Stock */}
                <p className="text-sm text-muted-foreground">
                  {viewingProduct.quantity_available > 0
                    ? `${viewingProduct.quantity_available} ${viewingProduct.unit_measure} available`
                    : "Out of stock"}
                </p>

                {/* Pricing tiers */}
                {viewingProduct.pricing_tiers && viewingProduct.pricing_tiers.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Available quantities:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingProduct.pricing_tiers.map((tier) => (
                        <Badge key={tier.unit} variant="outline" className="tabular-nums">
                          {tier.unit} — {currencySymbol}
                          {tier.price.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const inDialogCart = cart.find((c) => c.itemId === viewingProduct.id);
                return inDialogCart ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border p-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => removeFromCart(viewingProduct.id)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-12 text-center text-lg font-bold tabular-nums">
                      {inDialogCart.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      disabled={
                        inDialogCart.quantity >=
                        getMaxForUnit(
                          viewingProduct.quantity_available,
                          viewingProduct.unit_measure as string,
                          inDialogCart.unit,
                        )
                      }
                      onClick={() => addToCart(viewingProduct)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={viewingProduct.quantity_available <= 0}
                    onClick={() => addToCart(viewingProduct)}
                  >
                    <Plus className="size-4" />
                    Add to Cart
                  </Button>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Plus,
  Minus,
  MapPin,
  Clock,
  Check,
  AlertTriangle,
  Package,
  Loader2,
  X,
  Tag,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UNITS, WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { formatQuantityWithUnit, convertUnits } from "@/lib/utils/units";
import { createOrderSchema } from "@/lib/validations/orders";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { PublicItem, TokenGrade, DeliveryFeeTier } from "@/types/database";
import type { Unit } from "@/lib/utils/units";
import { AddressAutocomplete } from "./address-autocomplete";
import { NotificationPrompt } from "./notification-prompt";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface OrderFormProps {
  items: PublicItem[];
  token: string;
  grade: TokenGrade;
  expiresAt: string;
  currencySymbol?: string;
  feeTiers?: DeliveryFeeTier[];
}

const COUNT_UNIT_SET = new Set(["unit", "box", "pack", "tab", "piece"]);

interface CartItem {
  itemId: string;
  name: string;
  variety: string;
  imageUrl: string | null;
  price: number;
  basePrice: number;
  quantity: number;
  unit: Unit;
  stockQuantity: number;
  stockUnit: string;
  pricingTiers: { unit: string; price: number }[];
  lowStockThreshold: number | null;
  promoDiscount: number;
}

function getMaxForUnit(stockQty: number, stockUnit: string, cartUnit: string): number {
  const converted = convertUnits(stockQty, stockUnit, cartUnit);
  return Math.floor(converted);
}

interface SubmitResult {
  order_id?: string;
  delivery_code?: string;
  subtotal?: number;
  delivery_fee?: number;
  total?: number;
}

interface PromoResult {
  valid: boolean;
  promo_code_id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  discount_amount: number;
  new_total: number;
}

type SubmitState = "idle" | "submitting" | "success" | "error";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const REDIRECT_COUNTDOWN_SECONDS = 10;
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

const CATEGORY_LABELS: Record<string, string> = {
  WEED: "Weed",
  WAX: "Wax",
  PHATWOODS: "Phatwoods",
  EDIBLES: "Edibles",
};

// ────────────────────────────────────────────────────────────
// Product Image with fallback
// ────────────────────────────────────────────────────────────

function ProductImage({
  src,
  alt,
  className,
  sizes,
}: {
  src: string | null;
  alt: string;
  className?: string;
  sizes?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 ${className ?? ""}`}>
        <Package className="size-8 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes ?? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
      className={`object-cover ${className ?? ""}`}
      onError={() => setHasError(true)}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Expiration progress bar
// ────────────────────────────────────────────────────────────

function ExpirationBar({
  timeRemaining,
  totalDuration,
  isWarning,
  formatTime,
}: {
  timeRemaining: number;
  totalDuration: number;
  isWarning: boolean;
  formatTime: (ms: number) => string;
}) {
  const progress = totalDuration > 0 ? (timeRemaining / totalDuration) * 100 : 0;

  return (
    <motion.div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${
        isWarning
          ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border"
      }`}
      animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
      transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
    >
      {isWarning ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <Clock className="size-4 shrink-0" />
      )}
      <div className="flex-1 space-y-1">
        <span className="text-sm font-medium">{formatTime(timeRemaining)}</span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className={`h-full rounded-full ${isWarning ? "bg-amber-500" : "bg-primary"}`}
            initial={{ width: `${progress}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function OrderForm({
  items,
  token,
  expiresAt,
  currencySymbol = "$",
  feeTiers = [],
}: OrderFormProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [address, setAddress] = useState("");
  const [addressCoords, setAddressCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [countdown, setCountdown] = useState(REDIRECT_COUNTDOWN_SECONDS);
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<PromoResult | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<PublicItem | null>(null);

  const totalDuration = useMemo(
    () => Math.max(0, new Date(expiresAt).getTime() - Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [timeRemaining, setTimeRemaining] = useState<number>(totalDuration);

  const categories = useMemo(() => {
    const uniqueTypes = new Set(items.map((item) => item.type?.toUpperCase()).filter(Boolean));
    return Array.from(uniqueTypes).sort();
  }, [items]);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredItems = useMemo(() => {
    const filtered =
      selectedCategory === "all"
        ? items
        : items.filter((item) => item.type?.toUpperCase() === selectedCategory);
    // Featured items first
    return [...filtered].sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return 0;
    });
  }, [items, selectedCategory]);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setTimeRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (submitState !== "success") return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [submitState]);

  const formatTime = useCallback((ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  const isExpired = timeRemaining === 0;
  const isWarning = timeRemaining > 0 && timeRemaining <= WARNING_THRESHOLD_MS;

  const addToCart = useCallback((item: PublicItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        const max = getMaxForUnit(
          item.quantity_available,
          item.unit_measure as string,
          existing.unit,
        );
        if (existing.quantity >= max) return prev;
        return prev.map((c) => (c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      if (item.quantity_available <= 0) return prev;

      const tiers = item.pricing_tiers ?? [];
      const defaultUnit =
        tiers.length > 0 ? (tiers[0].unit as Unit) : (item.unit_measure as Unit) || "g";
      const tier = tiers.find((t) => t.unit === defaultUnit);

      let unitPrice = tier ? tier.price : item.price;
      const discount = Number(item.custom_fields?.promo_discount) || 0;
      const hasPromo = item.badges?.includes("PROMO") && discount > 0;
      if (hasPromo) {
        unitPrice = Math.round(unitPrice * (1 - discount / 100) * 100) / 100;
      }

      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          variety: item.variety,
          imageUrl: item.image_url ?? null,
          price: unitPrice,
          basePrice: item.price,
          quantity: 1,
          unit: defaultUnit,
          stockQuantity: item.quantity_available,
          stockUnit: (item.unit_measure as string) || "g",
          pricingTiers: tiers,
          lowStockThreshold: item.low_stock_threshold,
          promoDiscount: hasPromo ? discount : 0,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === itemId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((c) => c.itemId !== itemId);
      return prev.map((c) => (c.itemId === itemId ? { ...c, quantity: c.quantity - 1 } : c));
    });
  }, []);

  const updateCartUnit = useCallback((itemId: string, unit: Unit) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const tier = c.pricingTiers.find((t) => t.unit === unit);
        let price = tier ? tier.price : c.basePrice;
        if (c.promoDiscount > 0) {
          price = Math.round(price * (1 - c.promoDiscount / 100) * 100) / 100;
        }
        return { ...c, unit, price };
      }),
    );
  }, []);

  const updateCartQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) return;
    setCart((prev) =>
      prev.map((c) => {
        if (c.itemId !== itemId) return c;
        const max = getMaxForUnit(c.stockQuantity, c.stockUnit, c.unit);
        return { ...c, quantity: Math.min(quantity, max) };
      }),
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // Promo discount applied to the subtotal (recalculate when subtotal changes)
  const promoDiscount = useMemo(() => {
    if (!promoResult) return 0;
    if (promoResult.discount_type === "percentage") {
      return Math.round(cartSubtotal * (promoResult.discount_value / 100) * 100) / 100;
    }
    return Math.min(promoResult.discount_value, cartSubtotal);
  }, [promoResult, cartSubtotal]);

  const cartTotal = cartSubtotal - promoDiscount;

  const validatePromoCode = useCallback(async () => {
    const trimmed = promoCode.trim();
    if (!trimmed) return;

    setPromoLoading(true);
    setPromoError(null);
    setPromoResult(null);

    try {
      const res = await fetch("/api/promo-codes/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotal: cartSubtotal }),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setPromoError(errBody.error ?? "Invalid promo code");
        return;
      }

      const data = (await res.json()) as PromoResult;
      setPromoResult(data);
      setPromoCode(data.code);
    } catch {
      setPromoError("Failed to validate promo code. Please try again.");
    } finally {
      setPromoLoading(false);
    }
  }, [promoCode, cartSubtotal]);

  const removePromoCode = useCallback(() => {
    setPromoResult(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const handleSubmit = async () => {
    if (isExpired) {
      setSubmitError("This link has expired. You can no longer place an order.");
      setSubmitState("error");
      return;
    }

    if (cart.length === 0) {
      setSubmitError("Please add at least one product to your cart.");
      setSubmitState("error");
      return;
    }

    const orderData = {
      address,
      items: cart.map((c) => ({
        item_id: c.itemId,
        name: c.name,
        variety: c.variety,
        quantity: c.quantity,
        unit: c.unit,
      })),
      notes: notes || null,
      ...(addressCoords && {
        latitude: addressCoords.lat,
        longitude: addressCoords.lng,
      }),
      ...(promoResult && { promo_code: promoResult.code }),
    };

    const validation = createOrderSchema.safeParse(orderData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      setSubmitError(firstError?.message ?? "Invalid data");
      setSubmitState("error");
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    try {
      const res = await fetch(`/api/tokens/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        throw new Error(errBody.error ?? "Submission failed");
      }

      const data = (await res.json()) as SubmitResult;
      setSubmitResult(data);
      setSubmitState("success");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
      setSubmitState("error");
    }
  };

  // ── Success Screen ──
  if (submitState === "success") {
    return (
      <Card className="mx-auto max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 px-6 py-8 text-center text-white">
          <motion.div
            className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Check className="size-8" />
          </motion.div>
          <h2 className="mt-4 text-2xl font-bold">Order Confirmed</h2>
          <p className="mt-1 text-sm text-emerald-100">
            Your order has been submitted successfully
          </p>
        </div>

        <CardContent className="space-y-5 p-6">
          {submitResult?.delivery_code && (
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-4 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Delivery Code
              </p>
              <p className="mt-1 text-4xl font-black tracking-[0.25em] tabular-nums">
                {submitResult.delivery_code}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Give this code to the driver upon delivery
              </p>
            </div>
          )}

          {submitResult?.total !== undefined && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.subtotal?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery Fee</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.delivery_fee?.toFixed(2)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="tabular-nums">
                  {currencySymbol}
                  {submitResult.total.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {submitResult?.order_id && <NotificationPrompt orderId={submitResult.order_id} />}

          <p className="text-center text-xs text-muted-foreground">
            Do not refresh this page. It will close in {countdown}s
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Expired Screen ──
  if (isExpired && submitState !== "submitting") {
    return (
      <Card className="mx-auto max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
              <Clock className="size-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground">
              This order link has expired. Please request a new one from your supplier.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Timer */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Place an Order</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
            Browse our catalog and add products to your cart
          </p>
        </div>

        {/* Compact timer pill — mobile */}
        <motion.div
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium sm:hidden ${
            isWarning
              ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border"
          }`}
          animate={isWarning ? { opacity: [1, 0.7, 1] } : {}}
          transition={isWarning ? { repeat: 3, duration: 1.5 } : {}}
        >
          {isWarning ? <AlertTriangle className="size-3" /> : <Clock className="size-3" />}
          {formatTime(timeRemaining)}
        </motion.div>

        {/* Full timer bar — desktop */}
        <div className="hidden w-64 shrink-0 sm:block">
          <ExpirationBar
            timeRemaining={timeRemaining}
            totalDuration={totalDuration}
            isWarning={isWarning}
            formatTime={formatTime}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product Catalog */}
        <div className="space-y-3 sm:space-y-4 lg:col-span-2">
          {/* Sticky category filters — horizontal scroll on mobile */}
          <div className="sticky top-0 z-20 -mx-3 bg-background px-3 py-2 sm:static sm:mx-0 sm:px-0 sm:py-0">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                className="shrink-0"
                onClick={() => setSelectedCategory("all")}
              >
                All
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setSelectedCategory(cat!)}
                >
                  {CATEGORY_LABELS[cat!] ?? cat}
                </Button>
              ))}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Package className="size-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-medium">No products available</p>
                <p className="text-sm text-muted-foreground">
                  Try a different category or check back later
                </p>
              </div>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.itemId === item.id);
                const isOutOfStock = inCart
                  ? inCart.quantity >=
                    getMaxForUnit(item.quantity_available, item.unit_measure as string, inCart.unit)
                  : item.quantity_available <= 0;
                const isLowStock =
                  !isOutOfStock &&
                  item.low_stock_threshold != null &&
                  item.quantity_available <= item.low_stock_threshold;

                const promoPercent = Number(item.custom_fields?.promo_discount) || 0;
                const hasPromo = item.badges?.includes("PROMO") && promoPercent > 0;
                const discountedPrice = hasPromo
                  ? Math.round(item.price * (1 - promoPercent / 100) * 100) / 100
                  : item.price;

                return (
                  <motion.div key={item.id} variants={fadeUpItem}>
                    <Card
                      className={`group relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                        inCart ? "ring-2 ring-primary shadow-md shadow-primary/10" : ""
                      } ${
                        item.is_featured && !inCart
                          ? "ring-1 ring-amber-400/40 shadow-amber-400/10"
                          : ""
                      } ${isOutOfStock && !inCart ? "opacity-50 grayscale-[30%]" : ""}`}
                    >
                      {/* Image */}
                      <div
                        className="relative aspect-square w-full cursor-pointer overflow-hidden"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingProduct(item);
                        }}
                      >
                        <ProductImage
                          src={item.image_url}
                          alt={item.name}
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Featured — top left */}
                        {item.is_featured && (
                          <span className="absolute left-1.5 top-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-lg backdrop-blur-sm sm:left-2 sm:top-2 sm:px-2">
                            FEATURED
                          </span>
                        )}

                        {/* Cart count — top right */}
                        {inCart && (
                          <span className="absolute right-1.5 top-1.5 z-10 inline-flex items-center justify-center rounded-full bg-primary/90 px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground shadow-lg backdrop-blur-sm tabular-nums sm:right-2 sm:top-2 sm:px-2.5 sm:text-xs">
                            <span className="sm:hidden">{inCart.quantity}</span>
                            <span className="hidden sm:inline">{inCart.quantity} in cart</span>
                          </span>
                        )}

                        {/* Badges — bottom of image (max 2 visible on mobile) */}
                        <div className="absolute bottom-1.5 left-1.5 z-10 flex gap-1 sm:bottom-2 sm:left-2 sm:flex-wrap">
                          {item.badges?.map((badge) => (
                            <span
                              key={badge}
                              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm sm:px-2 ${
                                badge === "HOT"
                                  ? "bg-red-500/90 text-white"
                                  : badge === "PROMO"
                                    ? "bg-emerald-500/90 text-white"
                                    : "bg-blue-500/90 text-white"
                              }`}
                            >
                              {badge === "HOT"
                                ? "HOT"
                                : badge === "PROMO"
                                  ? `-${promoPercent}%`
                                  : "NEW"}
                            </span>
                          ))}
                          {isOutOfStock && (
                            <span className="inline-flex items-center rounded-full bg-red-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              OUT OF STOCK
                            </span>
                          )}
                          {isLowStock && (
                            <span className="inline-flex items-center rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm backdrop-blur-sm sm:px-2">
                              LOW STOCK
                            </span>
                          )}
                        </div>

                        {/* Variety name overlay — desktop only */}
                        <div className="absolute bottom-2 right-2 z-10 hidden max-w-[60%] text-right sm:block">
                          <p className="truncate text-sm font-semibold text-white drop-shadow-md">
                            {item.variety}
                          </p>
                        </div>
                      </div>

                      <CardContent className="space-y-2 p-3 sm:space-y-3 sm:p-4">
                        {/* Name + type */}
                        <div>
                          <p className="line-clamp-1 text-sm font-semibold leading-tight sm:text-base">
                            {item.name}
                          </p>
                          {item.type && (
                            <Badge
                              variant="outline"
                              className="mt-1 hidden text-[10px] sm:inline-flex"
                            >
                              {CATEGORY_LABELS[item.type.toUpperCase()] ?? item.type}
                            </Badge>
                          )}
                        </div>

                        {/* Pricing */}
                        {item.price > 0 && (
                          <div className="flex items-baseline gap-1 sm:gap-2">
                            {hasPromo ? (
                              <>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 sm:text-lg">
                                  {currencySymbol}
                                  {discountedPrice.toFixed(2)}
                                </span>
                                <span className="text-xs text-muted-foreground line-through sm:text-sm">
                                  {currencySymbol}
                                  {Number(item.price).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm font-bold sm:text-lg">
                                {currencySymbol}
                                {Number(item.price).toFixed(2)}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              /{item.unit_measure}
                            </span>
                          </div>
                        )}

                        {/* Stock availability */}
                        <p
                          className={`text-[11px] font-medium ${
                            isOutOfStock
                              ? "text-destructive"
                              : isLowStock
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {isOutOfStock
                            ? "Out of stock"
                            : `${formatQuantityWithUnit(item.quantity_available, item.unit_measure as string)} available`}
                        </p>

                        {/* Action — inline stepper when in cart */}
                        <AnimatePresence mode="wait">
                          {isOutOfStock ? (
                            <motion.div
                              key="oos"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button className="w-full" size="sm" variant="outline" disabled>
                                <span className="hidden sm:inline">Out of Stock</span>
                                <span className="text-xs sm:hidden">Sold Out</span>
                              </Button>
                            </motion.div>
                          ) : inCart ? (
                            <motion.div
                              key="stepper"
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="flex items-center justify-center gap-0.5 rounded-lg border"
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Minus className="size-4 sm:size-3.5" />
                              </Button>
                              <span className="w-8 text-center text-sm font-bold tabular-nums">
                                {inCart.quantity}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9 sm:size-8"
                                disabled={
                                  inCart.quantity >=
                                  getMaxForUnit(
                                    item.quantity_available,
                                    item.unit_measure as string,
                                    inCart.unit,
                                  )
                                }
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4 sm:size-3.5" />
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="add"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <Button
                                className="h-9 w-full sm:h-8"
                                size="sm"
                                onClick={() => addToCart(item)}
                              >
                                <Plus className="size-4" />
                                <span className="hidden sm:inline">Add to Cart</span>
                                <span className="sm:hidden">Add</span>
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Cart Sidebar — desktop only */}
        <div className="hidden space-y-4 lg:block">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart
                  {cartItemCount > 0 && <Badge variant="secondary">{cartItemCount}</Badge>}
                </CardTitle>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    Clear
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <ShoppingCart className="size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Your cart is empty</p>
                  <p className="text-xs text-muted-foreground">Add products from the catalog</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((cartItem) => (
                    <motion.div
                      key={cartItem.itemId}
                      className="space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <div className="flex items-start gap-2">
                        {/* Cart item thumbnail */}
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-muted">
                          <ProductImage src={cartItem.imageUrl} alt={cartItem.name} sizes="40px" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{cartItem.name}</p>
                          <p className="text-xs text-muted-foreground">{cartItem.variety}</p>
                        </div>
                        {cartItem.price > 0 && (
                          <span className="shrink-0 text-sm font-medium tabular-nums">
                            {currencySymbol}
                            {(cartItem.price * cartItem.quantity).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center rounded-md border">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            onClick={() => removeFromCart(cartItem.itemId)}
                          >
                            <Minus className="size-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={cartItem.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val > 0) {
                                updateCartQuantity(cartItem.itemId, val);
                              }
                            }}
                            className="h-8 w-12 border-0 p-0 text-center text-xs shadow-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={
                              cartItem.quantity >=
                              getMaxForUnit(
                                cartItem.stockQuantity,
                                cartItem.stockUnit,
                                cartItem.unit,
                              )
                            }
                            onClick={() => {
                              const original = items.find((i) => i.id === cartItem.itemId);
                              if (original) addToCart(original);
                            }}
                          >
                            <Plus className="size-3" />
                          </Button>
                        </div>

                        {(() => {
                          const tierUnits =
                            cartItem.pricingTiers.length > 0
                              ? cartItem.pricingTiers.map((t) => {
                                  const existing = UNITS.find((u) => u.value === t.unit);
                                  return existing ?? { value: t.unit as Unit, label: t.unit };
                                })
                              : null;
                          const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                            ? COUNT_UNITS
                            : WEIGHT_UNITS;
                          const unitList = tierUnits ?? fallbackUnits;
                          return (
                            <Select
                              value={cartItem.unit}
                              onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                            >
                              <SelectTrigger className="h-6 w-24 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {unitList.map((u) => (
                                  <SelectItem key={u.value} value={u.value}>
                                    {u.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatQuantityWithUnit(cartItem.quantity, cartItem.unit)}</span>
                        {cartItem.price > 0 && (
                          <span className="tabular-nums">
                            {currencySymbol}
                            {cartItem.price.toFixed(2)}/{cartItem.unit}
                          </span>
                        )}
                      </div>

                      <Separator />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {cart.length > 0 && cartSubtotal > 0 && (
                <div className="space-y-1 pt-2 text-sm">
                  <Separator />
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">
                      {currencySymbol}
                      {cartSubtotal.toFixed(2)}
                    </span>
                  </div>
                  {promoResult && promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Discount</span>
                      <span className="font-medium tabular-nums">
                        -{currencySymbol}
                        {promoDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {feeTiers.length > 0 && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Delivery fee</span>
                      <span>Calculated at checkout</span>
                    </div>
                  )}
                  {promoResult && promoDiscount > 0 && (
                    <>
                      <Separator />
                      <div className="flex justify-between pt-1 text-base font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">
                          {currencySymbol}
                          {cartTotal.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Promo Code */}
          {cart.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="size-4" />
                  Promo Code
                </div>

                {promoResult ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} applied
                        {" -- "}
                        {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {promoResult.discount_type === "percentage"
                          ? `${promoResult.discount_value}% discount`
                          : `${currencySymbol}${promoResult.discount_value.toFixed(2)} flat discount`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={removePromoCode}
                    >
                      <X className="size-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter promo code"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        if (promoError) setPromoError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          validatePromoCode();
                        }
                      }}
                      className="h-9 flex-1 uppercase"
                      disabled={promoLoading}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 shrink-0"
                      disabled={!promoCode.trim() || promoLoading}
                      onClick={validatePromoCode}
                    >
                      {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                    </Button>
                  </div>
                )}

                <AnimatePresence>
                  {promoError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-xs text-destructive"
                    >
                      {promoError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          )}

          {/* Delivery Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-5" />
                Delivery Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AddressAutocomplete
                value={address}
                onChange={(addr, coords) => {
                  setAddress(addr);
                  if (coords) setAddressCoords(coords);
                }}
              />
              <Input
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <AnimatePresence>
            {submitError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                <AlertTriangle className="size-4 shrink-0" />
                {submitError}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            className="w-full text-base font-semibold"
            size="lg"
            disabled={
              cart.length === 0 || !address.trim() || submitState === "submitting" || isExpired
            }
            onClick={handleSubmit}
          >
            {submitState === "submitting" ? (
              <>
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Submitting...
              </>
            ) : (
              <>
                <ShoppingCart className="size-5" />
                Submit Order
                {cartItemCount > 0 && (
                  <Badge variant="secondary" className="ml-1 tabular-nums">
                    {cartItemCount}
                  </Badge>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Spacer for fixed mobile cart bar */}
      {cart.length > 0 && <div className="h-16 lg:hidden" />}

      {/* Mobile cart bar — visible only below lg */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg lg:hidden">
          <Drawer>
            <DrawerTrigger asChild>
              <Button className="h-12 w-full text-base" size="lg">
                <ShoppingCart className="size-5" />
                <span>
                  {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
                </span>
                <span className="mx-1 text-muted-foreground/60">·</span>
                <span className="font-bold tabular-nums">
                  {currencySymbol}
                  {cartTotal.toFixed(2)}
                </span>
                <span className="ml-auto">View Cart</span>
                <ChevronUp className="ml-1 size-4" />
              </Button>
            </DrawerTrigger>
            <DrawerContent className="flex max-h-[85dvh] flex-col">
              <DrawerHeader className="flex shrink-0 flex-row items-center justify-between">
                <DrawerTitle className="flex items-center gap-2">
                  <ShoppingCart className="size-5" />
                  Cart ({cartItemCount})
                </DrawerTitle>
                <Button variant="ghost" size="sm" onClick={clearCart}>
                  Clear
                </Button>
              </DrawerHeader>

              {/* Scrollable content */}
              <div className="flex-1 space-y-4 overflow-y-auto px-4">
                {/* Cart items */}
                <div className="space-y-3">
                  {cart.map((cartItem) => {
                    const tierUnits =
                      cartItem.pricingTiers.length > 0
                        ? cartItem.pricingTiers.map((t) => {
                            const existing = UNITS.find((u) => u.value === t.unit);
                            return existing ?? { value: t.unit as Unit, label: t.unit };
                          })
                        : null;
                    const fallbackUnits = COUNT_UNIT_SET.has(cartItem.unit)
                      ? COUNT_UNITS
                      : WEIGHT_UNITS;
                    const unitList = tierUnits ?? fallbackUnits;

                    return (
                      <div key={cartItem.itemId} className="space-y-2.5">
                        <div className="flex items-start gap-3">
                          <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                            <ProductImage
                              src={cartItem.imageUrl}
                              alt={cartItem.name}
                              sizes="48px"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-base font-medium">{cartItem.name}</p>
                            <p className="text-sm text-muted-foreground">{cartItem.variety}</p>
                          </div>
                          {cartItem.price > 0 && (
                            <span className="shrink-0 text-base font-semibold tabular-nums">
                              {currencySymbol}
                              {(cartItem.price * cartItem.quantity).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center rounded-lg border">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              onClick={() => removeFromCart(cartItem.itemId)}
                            >
                              <Minus className="size-4" />
                            </Button>
                            <span className="w-10 text-center text-sm font-medium tabular-nums">
                              {cartItem.quantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              disabled={
                                cartItem.quantity >=
                                getMaxForUnit(
                                  cartItem.stockQuantity,
                                  cartItem.stockUnit,
                                  cartItem.unit,
                                )
                              }
                              onClick={() => {
                                const original = items.find((i) => i.id === cartItem.itemId);
                                if (original) addToCart(original);
                              }}
                            >
                              <Plus className="size-4" />
                            </Button>
                          </div>

                          <Select
                            value={cartItem.unit}
                            onValueChange={(val) => updateCartUnit(cartItem.itemId, val as Unit)}
                          >
                            <SelectTrigger className="h-9 w-24 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {unitList.map((u) => (
                                <SelectItem key={u.value} value={u.value}>
                                  {u.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {cartItem.price > 0 && (
                            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                              {currencySymbol}
                              {cartItem.price.toFixed(2)}/{cartItem.unit}
                            </span>
                          )}
                        </div>

                        <Separator />
                      </div>
                    );
                  })}
                </div>

                {/* Promo code */}
                <div className="space-y-2.5">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <Tag className="size-4" />
                    Promo Code
                  </p>
                  {promoResult ? (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {promoResult.code} &mdash; {currencySymbol}
                        {promoDiscount.toFixed(2)} off
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={removePromoCode}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value);
                          if (promoError) setPromoError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            validatePromoCode();
                          }
                        }}
                        className="h-9 flex-1 uppercase"
                        disabled={promoLoading}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        disabled={!promoCode.trim() || promoLoading}
                        onClick={validatePromoCode}
                      >
                        {promoLoading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  )}
                  {promoError && <p className="text-xs text-destructive">{promoError}</p>}
                </div>

                <Separator />

                {/* Address + Notes */}
                <div className="space-y-3 pb-4">
                  <p className="flex items-center gap-2 text-base font-semibold">
                    <MapPin className="size-4" />
                    Delivery Address
                  </p>
                  <AddressAutocomplete
                    value={address}
                    onChange={(addr, coords) => {
                      setAddress(addr);
                      if (coords) setAddressCoords(coords);
                    }}
                  />
                  <Textarea
                    placeholder="Delivery notes (optional)"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="resize-none text-base"
                  />
                </div>
              </div>

              {/* Sticky footer — always visible */}
              <div className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {cartSubtotal > 0 && (
                  <div className="mb-3 space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium tabular-nums">
                        {currencySymbol}
                        {cartSubtotal.toFixed(2)}
                      </span>
                    </div>
                    {promoResult && promoDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount</span>
                        <span className="font-medium tabular-nums">
                          -{currencySymbol}
                          {promoDiscount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {feeTiers.length > 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Delivery fee</span>
                        <span>Calculated at checkout</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between pt-1 text-base font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {currencySymbol}
                        {cartTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {submitError && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {submitError}
                  </div>
                )}

                <Button
                  className="h-12 w-full text-base font-semibold"
                  size="lg"
                  disabled={
                    cart.length === 0 ||
                    !address.trim() ||
                    submitState === "submitting" ||
                    isExpired
                  }
                  onClick={handleSubmit}
                >
                  {submitState === "submitting" ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="size-5" />
                      Submit Order
                    </>
                  )}
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog
        open={viewingProduct !== null}
        onOpenChange={(open) => {
          if (!open) setViewingProduct(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          {viewingProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingProduct.variety}</DialogTitle>
                <DialogDescription>
                  {viewingProduct.name}
                  {viewingProduct.type &&
                    ` — ${CATEGORY_LABELS[viewingProduct.type.toUpperCase()] ?? viewingProduct.type}`}
                </DialogDescription>
              </DialogHeader>

              {viewingProduct.image_url && (
                <div className="relative aspect-square w-full overflow-hidden rounded-lg">
                  <Image
                    src={viewingProduct.image_url}
                    alt={viewingProduct.variety}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 400px"
                  />
                </div>
              )}

              <div className="space-y-3">
                {/* Badges */}
                {viewingProduct.badges && viewingProduct.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingProduct.is_featured && (
                      <Badge className="bg-amber-500/90 text-white">FEATURED</Badge>
                    )}
                    {viewingProduct.badges.map((badge) => (
                      <Badge
                        key={badge}
                        className={
                          badge === "HOT"
                            ? "bg-red-500/90 text-white"
                            : badge === "PROMO"
                              ? "bg-emerald-500/90 text-white"
                              : "bg-blue-500/90 text-white"
                        }
                      >
                        {badge}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Price */}
                {viewingProduct.price > 0 && (
                  <div className="flex items-baseline gap-2">
                    {(() => {
                      const promoPercent =
                        Number(viewingProduct.custom_fields?.promo_discount) || 0;
                      const hasPromo = viewingProduct.badges?.includes("PROMO") && promoPercent > 0;
                      const discounted = hasPromo
                        ? Math.round(viewingProduct.price * (1 - promoPercent / 100) * 100) / 100
                        : viewingProduct.price;
                      return hasPromo ? (
                        <>
                          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {currencySymbol}
                            {discounted.toFixed(2)}
                          </span>
                          <span className="text-sm text-muted-foreground line-through">
                            {currencySymbol}
                            {Number(viewingProduct.price).toFixed(2)}
                          </span>
                          <Badge className="bg-emerald-500/90 text-white">-{promoPercent}%</Badge>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">
                          {currencySymbol}
                          {Number(viewingProduct.price).toFixed(2)}
                        </span>
                      );
                    })()}
                    <span className="text-sm text-muted-foreground">
                      /{viewingProduct.unit_measure}
                    </span>
                  </div>
                )}

                {/* Stock */}
                <p className="text-sm text-muted-foreground">
                  {viewingProduct.quantity_available > 0
                    ? `${viewingProduct.quantity_available} ${viewingProduct.unit_measure} available`
                    : "Out of stock"}
                </p>

                {/* Pricing tiers */}
                {viewingProduct.pricing_tiers && viewingProduct.pricing_tiers.length > 1 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Available quantities:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewingProduct.pricing_tiers.map((tier) => (
                        <Badge key={tier.unit} variant="outline" className="tabular-nums">
                          {tier.unit} — {currencySymbol}
                          {tier.price.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const inDialogCart = cart.find((c) => c.itemId === viewingProduct.id);
                return inDialogCart ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg border p-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      onClick={() => removeFromCart(viewingProduct.id)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-12 text-center text-lg font-bold tabular-nums">
                      {inDialogCart.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      disabled={
                        inDialogCart.quantity >=
                        getMaxForUnit(
                          viewingProduct.quantity_available,
                          viewingProduct.unit_measure as string,
                          inDialogCart.unit,
                        )
                      }
                      onClick={() => addToCart(viewingProduct)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={viewingProduct.quantity_available <= 0}
                    onClick={() => addToCart(viewingProduct)}
                  >
                    <Plus className="size-4" />
                    Add to Cart
                  </Button>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
