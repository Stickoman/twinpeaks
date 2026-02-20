import { createHash } from "crypto";

/**
 * Hash an IP address with a daily salt so rate-limit keys and audit logs
 * never store raw client IPs. The 16-hex-char prefix is enough for
 * collision-free bucketing while keeping stored values short.
 */
export function hashIp(ip: string): string {
  const today = new Date().toISOString().split("T")[0];
  return createHash("sha256").update(`${ip}:${today}`).digest("hex").slice(0, 16);
}
