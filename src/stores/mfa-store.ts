import { useSyncExternalStore } from "react";

// ────────────────────────────────────────────────────────────
// MFA verification state (in-memory, per-session)
// ────────────────────────────────────────────────────────────

interface MfaState {
  /** Whether MFA has been verified in this browser session */
  verified: boolean;
  /** When the MFA was verified (timestamp) */
  verifiedAt: number | null;
}

let state: MfaState = { verified: false, verifiedAt: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function getSnapshot(): MfaState {
  return state;
}

function getServerSnapshot(): MfaState {
  return { verified: false, verifiedAt: null };
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

// ────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────

const MFA_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function setMfaVerified() {
  state = { verified: true, verifiedAt: Date.now() };
  emit();
}

export function clearMfaVerified() {
  state = { verified: false, verifiedAt: null };
  emit();
}

export function isMfaExpired(): boolean {
  if (!state.verified || !state.verifiedAt) return true;
  return Date.now() - state.verifiedAt > MFA_TIMEOUT_MS;
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export function useMfaStore(): MfaState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
