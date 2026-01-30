import { createServiceClient } from "@/lib/supabase/service";

interface RateLimitResult {
  allowed: boolean;
}

/**
 * Check rate limit using the database-backed check_rate_limit() function.
 *
 * @param key - Unique identifier for the rate limit bucket (e.g. "token:GET:1.2.3.4")
 * @param maxRequests - Maximum requests allowed per window
 * @param windowSeconds - Window duration in seconds
 * @returns Whether the request is allowed
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number = 20,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Fail-closed: block requests when rate limiting is unavailable for security
    console.error("Rate limit check failed:", error);
    return { allowed: false };
  }

  return { allowed: !!data };
}
