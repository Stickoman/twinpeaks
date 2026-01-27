"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function WebAuthnRegister() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("My Passkey");

  const registerMutation = useMutation({
    mutationFn: async (credentialName: string) => {
      // Step 1: Get registration options
      const optRes = await fetch("/api/auth/webauthn/register", { method: "POST" });
      if (!optRes.ok) throw new Error("Failed to generate options");

      type RegOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
      const json = (await optRes.json()) as { options: unknown };

      // Step 2: Create credential via browser
      const credential = await startRegistration({
        optionsJSON: json.options as RegOptions,
      });

      // Step 3: Verify on server
      const verifyRes = await fetch("/api/auth/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, name: credentialName }),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json();
        throw new Error((data as { error?: string }).error ?? "Registration failed");
      }

      return (await verifyRes.json()) as { verified: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mfa-status"] });
      toast.success("Passkey registered successfully");
      setName("My Passkey");
    },
    onError: (err: Error) => {
      if (err.name === "NotAllowedError") {
        toast.error("Registration cancelled");
      } else {
        toast.error(err.message);
      }
    },
  });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="passkey-name">Passkey Name</Label>
        <div className="flex gap-2">
          <Input
            id="passkey-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MacBook, iPhone"
            maxLength={100}
          />
          <Button
            onClick={() => registerMutation.mutate(name)}
            disabled={registerMutation.isPending || !name.trim()}
          >
            {registerMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : registerMutation.isSuccess ? (
              <Check className="size-4" />
            ) : (
              <Fingerprint className="size-4" />
            )}
            Register
          </Button>
        </div>
      </div>
    </div>
  );
}
