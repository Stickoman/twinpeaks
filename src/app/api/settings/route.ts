import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { getAppSettings } from "@/lib/utils/settings";
import { appSettingsSchema } from "@/lib/validations/settings";

// ────────────────────────────────────────────────────────────
// GET /api/settings - Fetch app settings (any authenticated user)
// ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const supabase = createServiceClient();
  const settings = await getAppSettings(supabase);

  return NextResponse.json(settings);
}

// ────────────────────────────────────────────────────────────
// PUT /api/settings - Update app settings (admin only)
// ────────────────────────────────────────────────────────────

export async function PUT(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("super_admin");
  if (!auth.authenticated) return auth.response;

  const body: unknown = await request.json();
  const parsed = appSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid settings data", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const entries = Object.entries(parsed.data) as [string, unknown][];

  for (const [key, value] of entries) {
    const { error } = await supabase.from("app_settings").upsert(
      {
        key,
        value: JSON.parse(JSON.stringify(value)),
        updated_at: now,
        updated_by: auth.session.userId,
      },
      { onConflict: "key" },
    );

    if (error) {
      console.error(`Error upserting setting ${key}:`, error);
      return NextResponse.json({ error: `Failed to save setting: ${key}` }, { status: 500 });
    }
  }

  const settings = await getAppSettings(supabase);
  return NextResponse.json(settings);
}
