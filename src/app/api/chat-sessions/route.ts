import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { loadChatSessions, createChatSession } from "@/lib/db";

async function resolveUserId(fallback?: string | null): Promise<string | null> {
  const sessionId = await getAuthenticatedUserId();
  return sessionId ?? fallback ?? null;
}

function isDuplicateError(err: any): boolean {
  return err?.message?.includes("23505") ||
    err?.message?.includes("duplicate") ||
    err?.message?.includes("unique") ||
    err?.code === "23505";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = await resolveUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ sessions: [] });
  const sessions = await loadChatSessions(userId);
  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await resolveUserId(body.userId);
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 400 });

  try {
    const title = body.title || "Nova Conversa";
    const sessionId = await createChatSession(userId, title);
    return NextResponse.json({ sessionId, title });
  } catch (err: any) {
    if (isDuplicateError(err)) {
      return NextResponse.json(
        { error: `Já existe uma conversa com o nome "${body.title}". Escolhe um nome diferente.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await resolveUserId(body.userId);
  if (!userId || !body.sessionId || !body.title) {
    return NextResponse.json({ error: "Campos obrigatórios em falta" }, { status: 400 });
  }

  try {
    const { renameChatSession } = await import("@/lib/db");
    await renameChatSession(userId, body.sessionId, body.title);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (isDuplicateError(err)) {
      return NextResponse.json(
        { error: `Já existe uma conversa com o nome "${body.title}". Escolhe um nome diferente.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
