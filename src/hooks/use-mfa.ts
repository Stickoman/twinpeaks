import { useQuery } from "@tanstack/react-query";
import { useMfaStore, isMfaExpired, setMfaVerified } from "@/stores/mfa-store";

// ────────────────────────────────────────────────────────────
// MFA status hook
// ────────────────────────────────────────────────────────────

interface MfaMethod {
  id: string;
  type: "webauthn" | "totp";
  name: string;
  created_at: string;
}

interface MfaStatusResponse {
  enabled: boolean;
  methods: MfaMethod[];
  hasWebauthn: boolean;
  hasTotp: boolean;
}

export function useMfaStatus() {
  return useQuery<MfaStatusResponse>({
    queryKey: ["mfa-status"],
    queryFn: async () => {
      const res = await fetch("/api/auth/mfa/status");
      if (!res.ok) throw new Error("Failed to fetch MFA status");
      return res.json() as Promise<MfaStatusResponse>;
    },
    staleTime: 60_000,
  });
}

// ────────────────────────────────────────────────────────────
// MFA gate hook — combines status + session verification
// ────────────────────────────────────────────────────────────

export function useMfaGate() {
  const { data: status, isLoading } = useMfaStatus();
  const mfaState = useMfaStore();

  const isVerified = mfaState.verified && !isMfaExpired();
  const isRequired = status?.enabled ?? false;
  const needsChallenge = isRequired && !isVerified;

  return {
    isLoading,
    isRequired,
    isVerified,
    needsChallenge,
    hasWebauthn: status?.hasWebauthn ?? false,
    hasTotp: status?.hasTotp ?? false,
    verify: setMfaVerified,
  };
}
