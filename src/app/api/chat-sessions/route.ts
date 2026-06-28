import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { loadChatSessions, createChatSession, renameChatSession } from "@/lib/db";

function isDuplicateError(err: any): boolean {
  return err?.message?.includes("23505") ||
    err?.message?.includes("duplicate") ||
    err?.message?.includes("unique") ||
    err?.code === "23505";
}

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ sessions: [] });
  const sessions = await loadChatSessions(userId);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = body.title || "Nova Conversa";

  try {
    const sessionId = await createChatSession(userId, title);
    return NextResponse.json({ sessionId, title });
  } catch (err: any) {
    if (isDuplicateError(err)) {
      return NextResponse.json(
        { error: `Já existe uma conversa com o nome "${title}". Escolhe um nome diferente.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { sessionId, title } = body;
  if (!sessionId || !title) {
    return NextResponse.json({ error: "sessionId e title obrigatórios" }, { status: 400 });
  }

  try {
    await renameChatSession(userId, sessionId, title);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (isDuplicateError(err)) {
      return NextResponse.json(
        { error: `Já existe uma conversa com o nome "${title}". Escolhe um nome diferente.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
