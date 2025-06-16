-- ============================================================================
-- 00001_initial_schema.sql
-- Initial database schema for TP-Manager (custom auth, no Clerk)
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Generic trigger function that sets updated_at to NOW() on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================

CREATE TABLE profiles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username            TEXT        UNIQUE NOT NULL,
  password_hash       TEXT        NOT NULL,
  role                TEXT        CHECK (role IN ('admin', 'super_admin', 'god_admin')) DEFAULT 'admin',
  profile_picture_url TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles (username);
CREATE INDEX idx_profiles_role     ON profiles (role);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 2. ITEMS
-- ============================================================================

CREATE TABLE items (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (name <> ''),
  type         TEXT,
  variety       TEXT        NOT NULL,
  quantity     NUMERIC     NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_measure TEXT        DEFAULT 'g',
  image_url    TEXT,
  created_by   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_items_created_by ON items (created_by);
CREATE INDEX idx_items_variety     ON items (variety);
CREATE INDEX idx_items_type       ON items (type);

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. SECURE_TOKENS
-- ============================================================================

CREATE TABLE secure_tokens (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  token            TEXT        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  grade            TEXT        CHECK (grade IN ('classic', 'premium')) DEFAULT 'classic',
  expires_at       TIMESTAMPTZ NOT NULL,
  used             BOOLEAN     DEFAULT FALSE,
  fingerprint      TEXT,
  ip_address       TEXT,
  access_attempts  INTEGER     DEFAULT 0,
  locked           BOOLEAN     DEFAULT FALSE,
  created_by       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_secure_tokens_token      ON secure_tokens (token);
CREATE INDEX idx_secure_tokens_created_by ON secure_tokens (created_by);
CREATE INDEX idx_secure_tokens_expires_at ON secure_tokens (expires_at);
CREATE INDEX idx_secure_tokens_grade      ON secure_tokens (grade);

-- ============================================================================
-- 4. ORDERS
-- ============================================================================

CREATE TABLE orders (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  address    TEXT        NOT NULL,
  status     TEXT        CHECK (status IN ('pending', 'en_route', 'delivered', 'cancelled')) DEFAULT 'pending',
  grade      TEXT        CHECK (grade IN ('classic', 'premium')) NOT NULL,
  notes      TEXT,
  token_id   UUID        REFERENCES secure_tokens(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status   ON orders (status);
CREATE INDEX idx_orders_token_id ON orders (token_id);
CREATE INDEX idx_orders_grade    ON orders (grade);

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. ORDER_ITEMS
-- ============================================================================

CREATE TABLE order_items (
  id       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID    REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  item_id  UUID    REFERENCES items(id) ON DELETE SET NULL,
  name     TEXT    NOT NULL,
  variety   TEXT    NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit     TEXT    NOT NULL
);

CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_order_items_item_id  ON order_items (item_id);

-- ============================================================================
-- 6. AUDIT_LOGS
-- ============================================================================

CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   TEXT,
  actor_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor_id    ON audit_logs (actor_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs (entity_type);
CREATE INDEX idx_audit_logs_entity_id   ON audit_logs (entity_id);
CREATE INDEX idx_audit_logs_action      ON audit_logs (action);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs (created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Auth strategy:
--   - Admin API routes use the Supabase service_role key, which bypasses RLS entirely.
--   - Public endpoints (token validation, order submission) use the anon key.
--   - RLS policies below only need to handle the anon/public case:
--     permissive SELECT on secure_tokens (for token validation),
--     permissive SELECT on items (for the order form catalog),
--     permissive INSERT on orders + order_items (for placing orders).
--   - All other operations go through the service_role key (no RLS needed).
-- ============================================================================

-- Enable RLS on every table
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs    ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- PROFILES policies
-- No public access needed. All profile operations use service_role key.
-- --------------------------------------------------------------------------

-- (No policies needed -- service_role bypasses RLS)

-- --------------------------------------------------------------------------
-- ITEMS policies
-- Public can SELECT items for the order form catalog.
-- Admin CRUD uses service_role key (bypasses RLS).
-- --------------------------------------------------------------------------

CREATE POLICY items_public_read ON items
  FOR SELECT
  USING (true);

-- --------------------------------------------------------------------------
-- SECURE_TOKENS policies
-- Public can SELECT tokens for validation (by token value).
-- Public can UPDATE tokens (to mark as used / increment access_attempts).
-- Admin operations use service_role key (bypasses RLS).
-- --------------------------------------------------------------------------

CREATE POLICY secure_tokens_public_select ON secure_tokens
  FOR SELECT
  USING (true);

CREATE POLICY secure_tokens_public_update ON secure_tokens
  FOR UPDATE
  USING (true);

-- --------------------------------------------------------------------------
-- ORDERS policies
-- Public can INSERT orders (placing an order via the form).
-- Admin operations use service_role key (bypasses RLS).
-- --------------------------------------------------------------------------

CREATE POLICY orders_public_insert ON orders
  FOR INSERT
  WITH CHECK (true);

-- --------------------------------------------------------------------------
-- ORDER_ITEMS policies
-- Public can INSERT order items (when placing an order).
-- Public can SELECT order items (to display order confirmation).
-- Admin operations use service_role key (bypasses RLS).
-- --------------------------------------------------------------------------

CREATE POLICY order_items_public_insert ON order_items
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY order_items_public_read ON order_items
  FOR SELECT
  USING (true);

-- --------------------------------------------------------------------------
-- AUDIT_LOGS policies
-- No public access. All audit operations use service_role key.
-- --------------------------------------------------------------------------

-- (No policies needed -- service_role bypasses RLS)
