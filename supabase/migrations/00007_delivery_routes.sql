-- ────────────────────────────────────────────────────────────
-- Migration 007: Delivery Routes
-- Stores the complete route taken by a driver for each delivery.
-- Populated when a delivery is confirmed (order → delivered).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  route_points JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  distance_km NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_delivery_routes_order_id ON delivery_routes(order_id);
CREATE INDEX idx_delivery_routes_driver_id ON delivery_routes(driver_id);

-- RLS
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;

-- Admins can read all routes
CREATE POLICY "Admins can read delivery routes"
  ON delivery_routes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin', 'god_admin')
    )
  );

-- Drivers can read their own routes
CREATE POLICY "Drivers can read own routes"
  ON delivery_routes FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

-- Service role can insert (used by API)
CREATE POLICY "Service can insert delivery routes"
  ON delivery_routes FOR INSERT
  WITH CHECK (true);
