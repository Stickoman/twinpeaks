-- ============================================================
-- Migration 00010: Business Features v6
-- Items badges/featured, categories count_unit_label,
-- profiles is_trusted, orders promo fields,
-- pricing_tiers table, promo_codes table,
-- delivery-proofs storage bucket, increment_stock RPC,
-- RLS policies
-- ============================================================

-- ── Items: badges & featured ──────────────────────────────────
ALTER TABLE items ADD COLUMN IF NOT EXISTS badges TEXT[] DEFAULT '{}';
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- ── Categories: count unit label ──────────────────────────────
ALTER TABLE categories ADD COLUMN IF NOT EXISTS count_unit_label TEXT DEFAULT 'unit';

-- ── Profiles: trusted drivers ─────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT false;

-- ── Orders: promo code support ────────────────────────────────
-- promo_codes table must be created first for FK reference
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_amount NUMERIC(10,2) DEFAULT 0,
  max_uses INT,
  current_uses INT DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- ── Pricing tiers table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS pricing_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  unit TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  min_quantity INT DEFAULT 1,
  max_quantity INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Delivery proofs storage bucket ────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('delivery-proofs', 'delivery-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload delivery proofs
DO $$ BEGIN
  CREATE POLICY "Authenticated users can upload delivery proofs"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'delivery-proofs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Storage policy: public can read delivery proofs
DO $$ BEGIN
  CREATE POLICY "Public can read delivery proofs"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'delivery-proofs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RPC: increment_stock ──────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_stock(p_item_id UUID, p_quantity INT)
RETURNS VOID AS $$
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  UPDATE items
  SET quantity = quantity + p_quantity,
      updated_at = now()
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found: %', p_item_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── RLS: pricing_tiers (service_role only) ────────────────────
ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;

-- ── RLS: promo_codes (service_role only) ──────────────────────
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

-- ── App settings: default map coordinates ───────────────────
INSERT INTO app_settings (key, value)
VALUES
  ('default_latitude', '40.7128'),
  ('default_longitude', '-74.006')
ON CONFLICT (key) DO NOTHING;
