-- ============================================================
-- Migration 00014: Fix push_subscriptions unique constraint
-- Required for upsert on (order_id, endpoint) to work
-- ============================================================

-- Add unique constraint for upsert deduplication
ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_order_endpoint_unique
  UNIQUE (order_id, endpoint);
