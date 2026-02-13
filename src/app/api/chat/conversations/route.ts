import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { createConversationSchema } from "@/lib/validations/chat";

// ────────────────────────────────────────────────────────────
// GET /api/chat/conversations - List conversations for current user
// POST /api/chat/conversations - Create a new conversation
// ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;
    const isDriver = auth.session.role === "driver";

    const { data: conversations, error } = await supabase
      .from("chat_conversations")
      .select("id, admin_id, driver_id, last_message_at, created_at")
      .eq(isDriver ? "driver_id" : "admin_id", userId)
      .order("last_message_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
    }

    // Fetch participant names
    const participantIds = (conversations ?? []).map((c) => (isDriver ? c.admin_id : c.driver_id));
    const uniqueIds = [...new Set(participantIds)];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", uniqueIds.length > 0 ? uniqueIds : ["00000000-0000-0000-0000-000000000000"]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.username]));

    const enriched = (conversations ?? []).map((c) => ({
      ...c,
      participant_name: profileMap.get(isDriver ? c.admin_id : c.driver_id) ?? "Unknown",
    }));

    return NextResponse.json({ conversations: enriched });
  } catch (err) {
    console.error("[Chat conversations GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAuth("admin");
  if (!auth.authenticated) return auth.response;

  try {
    const body: unknown = await request.json();
    const parsed = createConversationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const supabase = createServiceClient();

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("admin_id", auth.session.userId)
      .eq("driver_id", parsed.data.driver_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ conversation: existing });
    }

    const { data: conversation, error } = await supabase
      .from("chat_conversations")
      .insert({
        admin_id: auth.session.userId,
        driver_id: parsed.data.driver_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating conversation:", error);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err) {
    console.error("[Chat conversations POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
