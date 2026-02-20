import { createServiceClient } from "@/lib/supabase/service";
import { headers } from "next/headers";
import { hashIp } from "@/lib/utils/hash-ip";

/**
 * Extract client IP from request headers.
 */
export async function getClientIp(): Promise<string | null> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headerStore.get("x-real-ip") ?? null;
}

/**
 * Fire-and-forget audit log entry.
 * Errors are silently caught to avoid breaking the main request flow.
 */
export function logAudit(params: {
  action: string;
  entityType: string;
  entityId?: string | null;
  actorId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}): void {
  const supabase = createServiceClient();

  supabase
    .from("audit_logs")
    .insert({
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      actor_id: params.actorId ?? null,
      details: params.details ?? null,
      ip_address: params.ipAddress ? hashIp(params.ipAddress) : null,
    })
    .then(({ error }) => {
      if (error) {
        console.error("Audit log error:", error.message);
      }
    });
}
