import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { saveChatMessages, loadChatHistory, clearChatHistory } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ messages: [] });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ messages: [] });

  const limit = Number(searchParams.get("limit") ?? 100);
  const messages = await loadChatHistory(userId, sessionId, limit);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sessionId, messages } = body;
  if (!sessionId || !messages?.length) return NextResponse.json({ success: true });

  try {
    await saveChatMessages(userId, sessionId, messages);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // Soft delete de mensagem individual
  if (body.messageId) {
    const { error } = await supabaseAdmin
      .from("chat_messages")
      .update({ status: "deleted" })
      .eq("id", body.messageId)
      .eq("user_id", userId); // garante que só apaga as próprias mensagens
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Arquivar sessão específica
  if (body.sessionId) {
    await clearChatHistory(userId, body.sessionId);
    return NextResponse.json({ success: true });
  }

  // Arquivar todo o histórico
  await clearChatHistory(userId);
  return NextResponse.json({ success: true });
}
