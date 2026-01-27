"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Smartphone, Loader2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface SetupData {
  qrCode: string;
  secret: string;
}

export function TotpSetup() {
  const queryClient = useQueryClient();
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState("");

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Failed to setup TOTP");
      }
      return res.json() as Promise<SetupData>;
    },
    onSuccess: (data) => setSetupData(data),
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: async (verifyCode: string) => {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Verification failed");
      }
      return res.json() as Promise<{ verified: boolean; setup?: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("Authenticator app configured successfully");
      setSetupData(null);
      setCode("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!setupData) {
    return (
      <Button
        variant="outline"
        onClick={() => setupMutation.mutate()}
        disabled={setupMutation.isPending}
      >
        {setupMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Smartphone className="size-4" />
        )}
        Set Up Authenticator App
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
      </div>

      <div className="flex justify-center rounded-lg border bg-white p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={setupData.qrCode} alt="TOTP QR Code" className="size-48" />
      </div>

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Manual entry key</Label>
        <div className="flex gap-2">
          <code className="flex-1 rounded border bg-muted px-3 py-2 text-xs font-mono">
            {setupData.secret}
          </code>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(setupData.secret);
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="size-4" />
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          verifyMutation.mutate(code);
        }}
        className="space-y-3"
      >
        <div className="space-y-2">
          <Label htmlFor="totp-code">Enter the 6-digit code from your app</Label>
          <div className="flex gap-2">
            <Input
              id="totp-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              pattern="\d{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button type="submit" disabled={code.length !== 6 || verifyMutation.isPending}>
              {verifyMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Verify
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
