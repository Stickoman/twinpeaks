import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";

// ────────────────────────────────────────────────────────────
// POST /api/chat/conversations/[id]/read - Mark messages as read
// ────────────────────────────────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const supabase = createServiceClient();

    // Verify user is part of this conversation
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("id, admin_id, driver_id")
      .eq("id", id)
      .single();

    if (
      !conv ||
      (conv.admin_id !== auth.session.userId && conv.driver_id !== auth.session.userId)
    ) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Mark all unread messages in this conversation that were sent by the other person
    const { error } = await supabase
      .from("chat_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .neq("sender_id", auth.session.userId)
      .is("read_at", null);

    if (error) {
      console.error("Error marking messages as read:", error);
      return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Chat read POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
