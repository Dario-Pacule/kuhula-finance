import { NextResponse } from "next/server";
import { saveChatMessages, loadChatHistory, clearChatHistory } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ messages: [] });

  const messages = await loadChatHistory(userId, 60);
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const { userId, messages } = await req.json();
  if (!userId || !messages?.length) return NextResponse.json({ success: true });

  try {
    await saveChatMessages(userId, messages);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ success: true });
  await clearChatHistory(userId);
  return NextResponse.json({ success: true });
}
