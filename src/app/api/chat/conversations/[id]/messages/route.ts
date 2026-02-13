import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuth } from "@/lib/api-auth";
import { sendMessageSchema } from "@/lib/validations/chat";

// ────────────────────────────────────────────────────────────
// GET /api/chat/conversations/[id]/messages - List messages
// POST /api/chat/conversations/[id]/messages - Send a message
// ────────────────────────────────────────────────────────────

export async function GET(
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

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("id, sender_id, content, read_at, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
    }

    return NextResponse.json({ messages: messages ?? [] });
  } catch (err) {
    console.error("[Chat messages GET] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await requireAuth();
  if (!auth.authenticated) return auth.response;

  const { id } = await params;

  try {
    const body: unknown = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

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

    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: id,
        sender_id: auth.session.userId,
        content: parsed.data.content,
      })
      .select()
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Update conversation last_message_at
    await supabase
      .from("chat_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    console.error("[Chat messages POST] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
