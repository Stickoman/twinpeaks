-- ────────────────────────────────────────────────────────────
-- Migration 00005: Driver/Delivery System
-- ────────────────────────────────────────────────────────────

-- Add driver role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'super_admin', 'god_admin', 'driver'));

-- Add driver-specific profile fields
ALTER TABLE profiles ADD COLUMN phone TEXT;
ALTER TABLE profiles ADD COLUMN vehicle_info TEXT;
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN DEFAULT true;

-- Add driver assignment fields to orders
ALTER TABLE orders ADD COLUMN assigned_driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN assigned_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN delivery_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN delivery_lng DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN latitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN longitude DOUBLE PRECISION;

-- Add 'assigned' to order status
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'assigned', 'en_route', 'delivered', 'cancelled'));

CREATE INDEX idx_orders_driver ON orders (assigned_driver_id);

-- Driver locations table (real-time GPS tracking)
CREATE TABLE driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_driver_locations_driver ON driver_locations (driver_id);
CREATE INDEX idx_driver_locations_time ON driver_locations (recorded_at DESC);

ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drivers can read their own location, admins via service_role
CREATE POLICY driver_locations_own_read ON driver_locations
  FOR SELECT
  USING (true);

CREATE POLICY driver_locations_own_insert ON driver_locations
  FOR INSERT
  WITH CHECK (true);

-- Delivery proofs
CREATE TABLE delivery_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  photo_url TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_proofs_order ON delivery_proofs (order_id);
CREATE INDEX idx_delivery_proofs_driver ON delivery_proofs (driver_id);

ALTER TABLE delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Cleanup old driver locations (>24h)
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM driver_locations
  WHERE recorded_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Enable realtime on driver_locations and orders
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
