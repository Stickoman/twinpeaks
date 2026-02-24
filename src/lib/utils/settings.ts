import type { AppSettings } from "@/types/database";
import type { createServiceClient } from "@/lib/supabase/service";

const DEFAULTS: AppSettings = {
  delivery_radius_miles: 30,
  currency_symbol: "$",
  min_order_amount: 0,
  delivery_fee_tiers: [
    { min_miles: 0, max_miles: 10, fee: 0 },
    { min_miles: 10, max_miles: 20, fee: 10 },
    { min_miles: 20, max_miles: 30, fee: 20 },
  ],
  default_latitude: 40.7128,
  default_longitude: -74.006,
};

/** Fetch app settings from DB and merge with defaults */
export async function getAppSettings(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<AppSettings> {
  const { data: rows } = await supabase.from("app_settings").select("key, value");

  if (!rows || rows.length === 0) return { ...DEFAULTS };

  const settings: AppSettings = { ...DEFAULTS };
  const settingsRecord = settings as Record<keyof AppSettings, unknown>;

  for (const row of rows) {
    if (row.key in settingsRecord) {
      settingsRecord[row.key as keyof AppSettings] = row.value;
    }
  }

  return settings;
}

export { DEFAULTS as APP_SETTINGS_DEFAULTS };
