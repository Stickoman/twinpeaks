-- ============================================================================
-- 00003_security_hardening.sql
-- Tighten RLS policies + add rate limiting table
-- ============================================================================

-- ============================================================================
-- 1. TIGHTEN SECURE_TOKENS POLICIES
-- ============================================================================

-- Drop overly permissive public update policy (service_role handles all token updates)
DROP POLICY IF EXISTS secure_tokens_public_update ON secure_tokens;

-- Replace overly permissive public select with restricted version
DROP POLICY IF EXISTS secure_tokens_public_select ON secure_tokens;
CREATE POLICY secure_tokens_public_select ON secure_tokens
  FOR SELECT
  USING (
    locked = false
    AND used = false
    AND expires_at > NOW()
  );

-- ============================================================================
-- 2. TIGHTEN ORDER_ITEMS POLICIES
-- ============================================================================

-- Drop public read on order_items (admin uses service_role, no public need)
DROP POLICY IF EXISTS order_items_public_read ON order_items;

-- Restrict public insert to only valid pending orders
DROP POLICY IF EXISTS order_items_public_insert ON order_items;
CREATE POLICY order_items_public_insert ON order_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND orders.status = 'pending'
    )
  );

-- ============================================================================
-- 3. TIGHTEN ORDERS POLICIES
-- ============================================================================

-- Restrict public insert to only allow pending status
DROP POLICY IF EXISTS orders_public_insert ON orders;
CREATE POLICY orders_public_insert ON orders
  FOR INSERT
  WITH CHECK (status = 'pending');

-- ============================================================================
-- 4. TIGHTEN ITEMS POLICIES
-- ============================================================================

-- Restrict public read to items with stock > 0
DROP POLICY IF EXISTS items_public_read ON items;
CREATE POLICY items_public_read ON items
  FOR SELECT
  USING (quantity > 0);

-- ============================================================================
-- 5. RATE LIMITING TABLE + FUNCTION
-- ============================================================================

CREATE TABLE rate_limits (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER   NOT NULL DEFAULT 1,
  UNIQUE(key, window_start)
);

CREATE INDEX idx_rate_limits_key ON rate_limits (key);
CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No public policies needed — only accessed via service_role

-- Rate limit check function
-- Returns true if request is allowed, false if rate limited
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Calculate the current window start (truncate to window boundary)
  v_window_start := date_trunc('minute', NOW());

  -- Try to insert or update the counter atomically
  INSERT INTO rate_limits (key, window_start, request_count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  -- Clean up old entries (older than 5 minutes)
  DELETE FROM rate_limits
  WHERE window_start < NOW() - INTERVAL '5 minutes';

  RETURN v_count <= p_max_requests;
END;
$$;
