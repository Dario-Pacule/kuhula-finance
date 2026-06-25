import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { saveChatMessages, loadChatHistory, clearChatHistory } from "@/lib/db";

async function resolveUserId(fallback?: string | null): Promise<string | null> {
  const sessionId = await getAuthenticatedUserId();
  return sessionId ?? fallback ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = await resolveUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ messages: [] });

  const limit = Number(searchParams.get("limit") ?? 100);
  const messages = await loadChatHistory(userId, limit);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const body = await req.json();
  const userId = await resolveUserId(body.userId);
  if (!userId || !body.messages?.length) return NextResponse.json({ success: true });

  try {
    await saveChatMessages(userId, body.messages);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await resolveUserId(body.userId);
  if (!userId) return NextResponse.json({ success: true });
  await clearChatHistory(userId);
  return NextResponse.json({ success: true });
}
