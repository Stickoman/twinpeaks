-- ────────────────────────────────────────────────────────────
-- Business features: pricing, delivery fees, delivery codes
-- ────────────────────────────────────────────────────────────

-- Add price to items
ALTER TABLE items ADD COLUMN price NUMERIC(10,2) DEFAULT 0 NOT NULL;

-- Add unit_price to order_items
ALTER TABLE order_items ADD COLUMN unit_price NUMERIC(10,2) DEFAULT 0 NOT NULL;

-- Add business fields to orders
ALTER TABLE orders ADD COLUMN subtotal NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN delivery_fee NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN total NUMERIC(10,2) DEFAULT 0 NOT NULL;
ALTER TABLE orders ADD COLUMN delivery_code CHAR(4);

-- ────────────────────────────────────────────────────────────
-- App settings table (key-value store)
-- ────────────────────────────────────────────────────────────

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only authenticated admins can read/write settings
CREATE POLICY app_settings_admin_read ON app_settings
  FOR SELECT
  USING (true);

CREATE POLICY app_settings_admin_write ON app_settings
  FOR ALL
  USING (true);

-- Seed default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('delivery_radius_miles', '30'::jsonb, 'Maximum delivery radius in miles'),
  ('currency_symbol', '"$"'::jsonb, 'Currency symbol for display'),
  ('min_order_amount', '0'::jsonb, 'Minimum order subtotal'),
  ('delivery_fee_tiers', '[{"min_miles":0,"max_miles":10,"fee":0},{"min_miles":10,"max_miles":20,"fee":10},{"min_miles":20,"max_miles":30,"fee":20}]'::jsonb, 'Delivery fee tiers based on distance');
