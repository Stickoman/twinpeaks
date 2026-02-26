-- ============================================================
-- Migration 00013: Epics 2-5 Tables
-- Push notifications, driver shifts, chat, MFA, payroll
-- ============================================================

-- ── Epic 2: Push Notifications ──────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_order ON push_subscriptions (order_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ── Epic 3: Driver Shifts ───────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  orders_completed INT DEFAULT 0,
  total_distance_km NUMERIC(10,2) DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_shifts_driver ON driver_shifts (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_shifts_started ON driver_shifts (started_at DESC);

ALTER TABLE driver_shifts ENABLE ROW LEVEL SECURITY;

-- ── Epic 4: In-App Chat ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES profiles(id),
  driver_id UUID NOT NULL REFERENCES profiles(id),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_id, driver_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_admin ON chat_conversations (admin_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_driver ON chat_conversations (driver_id);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages (created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ── Epic 5A: MFA (WebAuthn + TOTP) ─────────────────────────

CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  credential_type TEXT NOT NULL CHECK (credential_type IN ('webauthn', 'totp')),
  credential_id TEXT,
  public_key TEXT,
  counter BIGINT DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  totp_secret TEXT,
  name TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_credentials_user ON user_credentials (user_id);

ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS auth_challenges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_challenges_user ON auth_challenges (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires ON auth_challenges (expires_at);

ALTER TABLE auth_challenges ENABLE ROW LEVEL SECURITY;

-- Auto-cleanup expired challenges
CREATE OR REPLACE FUNCTION cleanup_expired_challenges()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth_challenges WHERE expires_at < now();
END;
$$;

-- ── Epic 5C: Driver Payroll ─────────────────────────────────

CREATE TABLE IF NOT EXISTS driver_payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_pay NUMERIC(10,2) DEFAULT 0,
  delivery_bonus NUMERIC(10,2) DEFAULT 0,
  total_pay NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_driver_payroll_driver ON driver_payroll (driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payroll_status ON driver_payroll (status);

ALTER TABLE driver_payroll ENABLE ROW LEVEL SECURITY;

-- ── Audit logs table (if not exists) ────────────────────────
-- Used by data purge feature
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
