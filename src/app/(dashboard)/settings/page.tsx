"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import {
  Sun,
  Moon,
  Info,
  User,
  KeyRound,
  Loader2,
  Truck,
  Plus,
  Trash2,
  MapPin,
  ShieldCheck,
  Fingerprint,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import { getRoleLabel } from "@/lib/utils/order-status";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import type { AppSettings, DeliveryFeeTier } from "@/types/database";
import { useMfaStatus } from "@/hooks/use-mfa";
import { WebAuthnRegister } from "@/components/auth/webauthn-register";
import { TotpSetup } from "@/components/auth/totp-setup";

interface UserInfo {
  username: string;
  role: string;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && theme === "dark";

  const { data: user } = useQuery<UserInfo | null>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      return res.json() as Promise<UserInfo>;
    },
    staleTime: Infinity,
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [addressSearch, setAddressSearch] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Delivery settings
  const [deliverySettings, setDeliverySettings] = useState<AppSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as AppSettings;
      setDeliverySettings(data);
      return data;
    },
    staleTime: 60_000,
    enabled: deliverySettings === null,
  });

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 12) {
      toast.error("Password must be at least 12 characters");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      toast.error("Password must contain at least one uppercase letter");
      return;
    }

    if (!/[a-z]/.test(newPassword)) {
      toast.error("Password must contain at least one lowercase letter");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      toast.error("Password must contain at least one number");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (res.ok) {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to change password");
      }
    } catch {
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSaveDeliverySettings(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!deliverySettings) return;

    setSavingSettings(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliverySettings),
      });

      if (res.ok) {
        const data: AppSettings = await res.json();
        setDeliverySettings(data);
        toast.success("Delivery settings saved");
      } else {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  function updateTier(index: number, field: keyof DeliveryFeeTier, value: number) {
    if (!deliverySettings) return;
    const tiers = [...deliverySettings.delivery_fee_tiers];
    tiers[index] = { ...tiers[index], [field]: value };
    setDeliverySettings({ ...deliverySettings, delivery_fee_tiers: tiers });
  }

  function addTier() {
    if (!deliverySettings) return;
    const tiers = deliverySettings.delivery_fee_tiers;
    const lastMax = tiers.length > 0 ? tiers[tiers.length - 1].max_miles : 0;
    setDeliverySettings({
      ...deliverySettings,
      delivery_fee_tiers: [...tiers, { min_miles: lastMax, max_miles: lastMax + 10, fee: 0 }],
    });
  }

  function removeTier(index: number) {
    if (!deliverySettings) return;
    const tiers = deliverySettings.delivery_fee_tiers.filter((_, i) => i !== index);
    setDeliverySettings({ ...deliverySettings, delivery_fee_tiers: tiers });
  }

  return (
    <motion.div
      className="space-y-8"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Page title */}
      <motion.div variants={fadeUpItem}>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and application preferences</p>
      </motion.div>

      {/* Profile section */}
      <motion.section className="space-y-4" variants={fadeUpItem}>
        <h2 className="text-xl font-semibold text-foreground">Profile</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="size-4" />
              Account Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Username</p>
                  <p className="text-sm text-muted-foreground">{user.username}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <Badge variant="secondary">{getRoleLabel(user.role)}</Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading account information...</p>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <Separator />

      {/* Change password section */}
      <motion.section className="space-y-4" variants={fadeUpItem}>
        <h2 className="text-xl font-semibold text-foreground">Security</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="size-4" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" disabled={changingPassword}>
                {changingPassword && <Loader2 className="mr-2 size-4 animate-spin" />}
                Change Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.section>

      <Separator />

      {/* MFA section */}
      <MfaSection />

      <Separator />

      {/* Delivery Settings */}
      <motion.section className="space-y-4" variants={fadeUpItem}>
        <h2 className="text-xl font-semibold text-foreground">Delivery Settings</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="size-4" />
              Delivery Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deliverySettings ? (
              <form onSubmit={handleSaveDeliverySettings} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="delivery-radius">Delivery Radius (miles)</Label>
                    <Input
                      id="delivery-radius"
                      type="number"
                      min={1}
                      max={500}
                      value={deliverySettings.delivery_radius_miles}
                      onChange={(e) =>
                        setDeliverySettings({
                          ...deliverySettings,
                          delivery_radius_miles: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency-symbol">Currency Symbol</Label>
                    <Input
                      id="currency-symbol"
                      value={deliverySettings.currency_symbol}
                      maxLength={5}
                      onChange={(e) =>
                        setDeliverySettings({
                          ...deliverySettings,
                          currency_symbol: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="min-order">Minimum Order Amount</Label>
                    <Input
                      id="min-order"
                      type="number"
                      min={0}
                      step="0.01"
                      value={deliverySettings.min_order_amount}
                      onChange={(e) =>
                        setDeliverySettings({
                          ...deliverySettings,
                          min_order_amount: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Delivery Fee Tiers</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTier}>
                      <Plus className="size-4" />
                      Add Tier
                    </Button>
                  </div>

                  {deliverySettings.delivery_fee_tiers.map((tier, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-2"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Min (mi)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={tier.min_miles}
                          onChange={(e) => updateTier(index, "min_miles", Number(e.target.value))}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Max (mi)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={tier.max_miles}
                          onChange={(e) => updateTier(index, "max_miles", Number(e.target.value))}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Fee ($)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={tier.fee}
                          onChange={(e) => updateTier(index, "fee", Number(e.target.value))}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTier(index)}
                        disabled={deliverySettings.delivery_fee_tiers.length <= 1}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <MapPin className="size-4" />
                    Default Map Location
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Fallback center when no driver positions are available. Type an address to
                    auto-fill coordinates.
                  </p>
                  <AddressAutocomplete
                    value={addressSearch}
                    placeholder="Search an address to set coordinates..."
                    onChange={(addr, coords) => {
                      setAddressSearch(addr);
                      if (coords) {
                        setDeliverySettings({
                          ...deliverySettings,
                          default_latitude: Math.round(coords.lat * 10000) / 10000,
                          default_longitude: Math.round(coords.lng * 10000) / 10000,
                        });
                      }
                    }}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Latitude</Label>
                      <Input
                        type="number"
                        min={-90}
                        max={90}
                        step="0.0001"
                        value={deliverySettings.default_latitude}
                        onChange={(e) =>
                          setDeliverySettings({
                            ...deliverySettings,
                            default_latitude: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Longitude</Label>
                      <Input
                        type="number"
                        min={-180}
                        max={180}
                        step="0.0001"
                        value={deliverySettings.default_longitude}
                        onChange={(e) =>
                          setDeliverySettings({
                            ...deliverySettings,
                            default_longitude: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={savingSettings}>
                  {savingSettings && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Save Delivery Settings
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Loading delivery settings...</p>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <Separator />

      {/* Application preferences */}
      <motion.section className="space-y-4" variants={fadeUpItem}>
        <h2 className="text-xl font-semibold text-foreground">Application Preferences</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
              Dark Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label htmlFor="dark-mode" className="text-sm text-muted-foreground">
                Enable dark mode for better readability in low-light environments
              </Label>
              <Switch
                id="dark-mode"
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>
      </motion.section>

      <Separator />

      {/* About */}
      <motion.section className="space-y-4" variants={fadeUpItem}>
        <h2 className="text-xl font-semibold text-foreground">About</h2>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Info className="size-4" />
              TP-Manager
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-foreground">Version</p>
                <p className="text-sm text-muted-foreground">0.1.0</p>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Environment</p>
                <p className="text-sm text-muted-foreground">
                  {process.env.NODE_ENV === "production" ? "Production" : "Development"}
                </p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium text-foreground">Tech Stack</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Next.js 16</Badge>
                <Badge variant="secondary">React 19</Badge>
                <Badge variant="secondary">TypeScript</Badge>
                <Badge variant="secondary">Tailwind CSS 4</Badge>
                <Badge variant="secondary">shadcn/ui</Badge>
                <Badge variant="secondary">Supabase</Badge>
                <Badge variant="secondary">TanStack Query</Badge>
                <Badge variant="secondary">Zod</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// MFA setup section
// ────────────────────────────────────────────────────────────

function MfaSection() {
  const { data: mfaStatus, isLoading } = useMfaStatus();

  return (
    <motion.section className="space-y-4" variants={fadeUpItem}>
      <h2 className="text-xl font-semibold text-foreground">Multi-Factor Authentication</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            MFA Methods
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading MFA status...</p>
          ) : (
            <>
              {/* Current methods */}
              {mfaStatus && mfaStatus.methods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Registered Methods</p>
                  <div className="space-y-2">
                    {mfaStatus.methods.map((method) => (
                      <div
                        key={method.id}
                        className="flex items-center gap-3 rounded-lg border p-3"
                      >
                        {method.type === "webauthn" ? (
                          <Fingerprint className="size-4 text-primary" />
                        ) : (
                          <Smartphone className="size-4 text-primary" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">{method.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {method.type === "webauthn" ? "Passkey" : "Authenticator App"} — added{" "}
                            {new Date(method.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        >
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add WebAuthn */}
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Add Passkey (WebAuthn)</p>
                  <p className="text-xs text-muted-foreground">
                    Use Face ID, Touch ID, or a hardware security key
                  </p>
                </div>
                <WebAuthnRegister />
              </div>

              {/* Add TOTP */}
              {!mfaStatus?.hasTotp && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Authenticator App (TOTP)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Use Google Authenticator, Authy, or similar
                      </p>
                    </div>
                    <TotpSetup />
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}
