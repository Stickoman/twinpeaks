"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { startAuthentication } from "@simplewebauthn/browser";
import { ShieldCheck, Fingerprint, Smartphone, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useMfaGate } from "@/hooks/use-mfa";

interface MfaGateProps {
  children: React.ReactNode;
}

export function MfaGate({ children }: MfaGateProps) {
  const gate = useMfaGate();

  if (gate.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No MFA set up → allow through (nothing to challenge)
  if (!gate.isRequired) {
    return <>{children}</>;
  }

  // Already verified → allow through
  if (!gate.needsChallenge) {
    return <>{children}</>;
  }

  return (
    <MfaChallenge hasWebauthn={gate.hasWebauthn} hasTotp={gate.hasTotp} onVerified={gate.verify} />
  );
}

// ────────────────────────────────────────────────────────────
// Challenge UI
// ────────────────────────────────────────────────────────────

interface MfaChallengeProps {
  hasWebauthn: boolean;
  hasTotp: boolean;
  onVerified: () => void;
}

function MfaChallenge({ hasWebauthn, hasTotp, onVerified }: MfaChallengeProps) {
  const [mode, setMode] = useState<"webauthn" | "totp">(hasWebauthn ? "webauthn" : "totp");

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <CardTitle>Identity Verification Required</CardTitle>
          <p className="text-sm text-muted-foreground">
            This action requires additional authentication
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "webauthn" && hasWebauthn && <WebAuthnChallenge onVerified={onVerified} />}
          {mode === "totp" && hasTotp && <TotpChallenge onVerified={onVerified} />}

          {hasWebauthn && hasTotp && (
            <div className="text-center">
              <Button
                variant="link"
                size="sm"
                onClick={() => setMode(mode === "webauthn" ? "totp" : "webauthn")}
              >
                {mode === "webauthn" ? "Use authenticator app instead" : "Use passkey instead"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// WebAuthn challenge
// ────────────────────────────────────────────────────────────

function WebAuthnChallenge({ onVerified }: { onVerified: () => void }) {
  const authMutation = useMutation({
    mutationFn: async () => {
      // Step 1: Get authentication options
      const optRes = await fetch("/api/auth/webauthn/authenticate", { method: "POST" });
      if (!optRes.ok) throw new Error("Failed to generate options");

      type AuthOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];
      const json = (await optRes.json()) as { options: unknown };

      // Step 2: Authenticate via browser
      const credential = await startAuthentication({
        optionsJSON: json.options as AuthOptions,
      });

      // Step 3: Verify on server
      const verifyRes = await fetch("/api/auth/webauthn/authenticate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error((data as { error?: string }).error ?? "Verification failed");
      }

      return (await verifyRes.json()) as { verified: boolean };
    },
    onSuccess: () => onVerified(),
    onError: (err: Error) => {
      if (err.name === "NotAllowedError") {
        toast.error("Authentication cancelled");
      } else {
        toast.error(err.message);
      }
    },
  });

  return (
    <Button
      className="w-full"
      size="lg"
      onClick={() => authMutation.mutate()}
      disabled={authMutation.isPending}
    >
      {authMutation.isPending ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Fingerprint className="size-5" />
      )}
      Verify with Passkey
    </Button>
  );
}

// ────────────────────────────────────────────────────────────
// TOTP challenge
// ────────────────────────────────────────────────────────────

function TotpChallenge({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (verifyCode: string) => {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error((data as { error?: string }).error ?? "Invalid code");
      }
      return res.json() as Promise<{ verified: boolean }>;
    },
    onSuccess: () => onVerified(),
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verifyMutation.mutate(code);
      }}
      className="space-y-3"
    >
      <div className="space-y-2">
        <Label htmlFor="mfa-totp-code" className="flex items-center gap-2">
          <Smartphone className="size-4" />
          Enter 6-digit code
        </Label>
        <Input
          id="mfa-totp-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          pattern="\d{6}"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
        />
      </div>
      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={code.length !== 6 || verifyMutation.isPending}
      >
        {verifyMutation.isPending ? <Loader2 className="size-5 animate-spin" /> : "Verify"}
      </Button>
    </form>
  );
}
