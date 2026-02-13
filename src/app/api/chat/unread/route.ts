import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// GET /api/chat/unread - Get total unread message count
// ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  try {
    const supabase = createServiceClient();
    const userId = auth.session.userId;
    const isDriver = auth.session.role === "driver";

    // Get conversations this user is part of
    const { data: conversations } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq(isDriver ? "driver_id" : "admin_id", userId);

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    const conversationIds = conversations.map((c) => c.id);

    // Count unread messages not sent by current user
    const { count, error } = await supabase
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .neq("sender_id", userId)
      .is("read_at", null);

    if (error) {
      console.error("Error counting unread:", error);
      return NextResponse.json({ count: 0 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err) {
    console.error("[Chat unread GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
