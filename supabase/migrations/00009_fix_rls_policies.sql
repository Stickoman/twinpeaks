-- Fix overly permissive RLS policies
-- All data access goes through service_role client, so deny-all for anon/authenticated

-- ── app_settings: remove USING(true) policies ──────────────────
DROP POLICY IF EXISTS app_settings_admin_read ON app_settings;
DROP POLICY IF EXISTS app_settings_admin_write ON app_settings;

-- ── driver_locations: remove USING(true) policies ──────────────
DROP POLICY IF EXISTS driver_locations_own_read ON driver_locations;
DROP POLICY IF EXISTS driver_locations_own_insert ON driver_locations;

-- ── delivery_routes: remove broken auth.uid() policies ─────────
DROP POLICY IF EXISTS "Admins can read delivery routes" ON delivery_routes;
DROP POLICY IF EXISTS "Drivers can read own routes" ON delivery_routes;
DROP POLICY IF EXISTS "Service can insert delivery routes" ON delivery_routes;
