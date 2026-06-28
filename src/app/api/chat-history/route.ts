import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { saveChatMessages, loadChatHistory, clearChatHistory } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

async function resolveUserId(fallback?: string | null): Promise<string | null> {
  const sessionId = await getAuthenticatedUserId();
  return sessionId ?? fallback ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = await resolveUserId(searchParams.get("userId"));
  const sessionId = searchParams.get("sessionId");
  if (!userId || !sessionId) return NextResponse.json({ messages: [] });
  const limit = Number(searchParams.get("limit") ?? 100);
  const messages = await loadChatHistory(userId, sessionId, limit);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const body = await req.json();
  const userId = await resolveUserId(body.userId);
  const sessionId = body.sessionId;
  if (!userId || !sessionId || !body.messages?.length) return NextResponse.json({ success: true });
  try {
    await saveChatMessages(userId, sessionId, body.messages);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await resolveUserId(body.userId);

  // Soft delete de mensagem individual
  if (body.messageId) {
    if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const { error } = await supabaseAdmin
      .from("chat_messages")
      .update({ status: "deleted" })
      .eq("id", body.messageId)
      .eq("user_id", userId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Limpar toda a sessão (clear all)
  const sessionId = body.sessionId;
  if (!userId) return NextResponse.json({ success: true });
  await clearChatHistory(userId, sessionId);
  return NextResponse.json({ success: true });
}
