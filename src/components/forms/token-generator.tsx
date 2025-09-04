"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link, Copy, Check, Clock, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { TOKEN_TTL_MINUTES } from "@/lib/utils/constants";
import { staggerContainer, fadeUpItem } from "@/lib/motion";
import type { SecureToken, TokenGrade } from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TokenWithUrl extends SecureToken {
  url: string;
  ttl_minutes: number;
}

interface ActiveToken {
  url: string;
  expiresAt: string;
  grade: TokenGrade;
}

type TokenStatus = "active" | "expired" | "used" | "locked";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTokenStatus(token: SecureToken): TokenStatus {
  if (token.locked) return "locked";
  if (token.used) return "used";
  if (new Date(token.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

function getStatusBadge(status: TokenStatus) {
  switch (status) {
    case "active":
      return (
        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600">
          <ShieldCheck className="size-3" />
          Active
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="secondary">
          <Clock className="size-3" />
          Expired
        </Badge>
      );
    case "used":
      return (
        <Badge variant="outline">
          <Shield className="size-3" />
          Used
        </Badge>
      );
    case "locked":
      return (
        <Badge variant="destructive">
          <ShieldAlert className="size-3" />
          Locked
        </Badge>
      );
  }
}

function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "00:00";
  const m = Math.floor(secondsRemaining / 60);
  const s = secondsRemaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Countdown hook
// ---------------------------------------------------------------------------

function useCountdown(expiresAt: string | null) {
  const computeRemaining = useCallback(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  }, [expiresAt]);

  const [remaining, setRemaining] = useState(computeRemaining);
  const [trackedExpiry, setTrackedExpiry] = useState(expiresAt);

  if (trackedExpiry !== expiresAt) {
    setTrackedExpiry(expiresAt);
    setRemaining(computeRemaining());
  }

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const next = computeRemaining();
      setRemaining(next);
      if (next <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, computeRemaining]);

  return remaining;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TokenGenerator() {
  const queryClient = useQueryClient();
  const [activeToken, setActiveToken] = useState<ActiveToken | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const remaining = useCountdown(activeToken?.expiresAt ?? null);

  const { data: tokens = [] } = useQuery<SecureToken[]>({
    queryKey: ["tokens"],
    queryFn: async () => {
      const res = await fetch("/api/tokens");
      if (!res.ok) throw new Error("Failed to load tokens.");
      return res.json() as Promise<SecureToken[]>;
    },
  });

  const createToken = useMutation<TokenWithUrl, Error, TokenGrade>({
    mutationFn: async (grade) => {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to create token.");
      }
      return res.json() as Promise<TokenWithUrl>;
    },
    onSuccess: (data) => {
      setActiveToken({
        url: data.url,
        expiresAt: data.expires_at,
        grade: data.grade,
      });
      void queryClient.invalidateQueries({ queryKey: ["tokens"] });
      toast.success("Link generated successfully!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  }

  if (activeToken && remaining <= 0) {
    setActiveToken(null);
  }

  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Generator buttons */}
      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="size-5" />
              Generate Access Link
            </CardTitle>
            <CardDescription>
              Select the access level to generate a temporary link ({TOKEN_TTL_MINUTES} minutes).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <Button
                onClick={() => createToken.mutate("classic")}
                disabled={createToken.isPending}
                variant="outline"
                className="gap-2"
              >
                <Shield className="size-4" />
                Generate Classic Link
              </Button>
              <Button
                onClick={() => createToken.mutate("premium")}
                disabled={createToken.isPending}
                className="gap-2"
              >
                <ShieldCheck className="size-4" />
                Generate Premium Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Active token display */}
      <AnimatePresence>
        {activeToken && remaining > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <Card className="border-emerald-500/50 animate-pulse-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-500">
                  <ShieldCheck className="size-5" />
                  Active Link &mdash; {activeToken.grade === "classic" ? "Classic" : "Premium"}
                </CardTitle>
                <CardDescription>
                  Share this link with the client. It expires in {formatCountdown(remaining)}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input readOnly value={activeToken.url} className="font-mono text-sm" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => handleCopy(activeToken.url)}
                    title="Copy link"
                  >
                    <AnimatePresence mode="wait">
                      {copiedUrl ? (
                        <motion.div
                          key="check"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Check className="size-4 text-emerald-500" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="copy"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                        >
                          <Copy className="size-4" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Button>
                </div>
                <motion.div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  animate={remaining <= 60 ? { opacity: [1, 0.5, 1] } : {}}
                  transition={remaining <= 60 ? { repeat: 3, duration: 1 } : {}}
                >
                  <Clock className="size-4" />
                  <span>Time remaining: {formatCountdown(remaining)}</span>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Separator />

      {/* Token history */}
      <motion.div variants={fadeUpItem}>
        <Card>
          <CardHeader>
            <CardTitle>Link History</CardTitle>
            <CardDescription>All generated links with their current status.</CardDescription>
          </CardHeader>
          <CardContent>
            {tokens.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links generated yet.</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => {
                  const status = getTokenStatus(token);
                  return (
                    <div key={token.id} className="rounded-lg border px-2.5 py-2 sm:px-3 sm:py-3">
                      {/* Row 1: token hash + grade badge + status badge + copy */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                          {token.token}
                        </span>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] px-1.5 py-0 sm:text-xs sm:px-2.5 sm:py-0.5"
                        >
                          {token.grade === "classic" ? "Classic" : "Premium"}
                        </Badge>
                        <span className="shrink-0">{getStatusBadge(status)}</span>
                        {status === "active" && (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            className="shrink-0"
                            onClick={() =>
                              handleCopy(`${window.location.origin}/form/${token.token}`)
                            }
                            title="Copy link"
                          >
                            <Copy className="size-3" />
                          </Button>
                        )}
                      </div>
                      {/* Row 2: expiry date */}
                      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
                        Expires:{" "}
                        {new Date(token.expires_at).toLocaleString("en-US", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
