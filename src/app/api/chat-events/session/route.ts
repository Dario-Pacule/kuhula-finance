/**
 * POST /api/chat-events/session
 * Regista uma nova sessão de chat na DB.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { userId: bodyUserId, provider, model, sessionId } = body;

  const sessionUserId = await getAuthenticatedUserId();
  const userId = sessionUserId ?? bodyUserId;

  if (!userId || !sessionId) {
    return NextResponse.json({ error: "userId e sessionId obrigatórios" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({
      id:       sessionId,
      user_id:  userId,
      provider: provider ?? "gemini",
      model:    model ?? "unknown",
    });

  if (error && !error.message.includes("duplicate")) {
    console.error("[chat-events/session]", error.message);
  }

  return NextResponse.json({ success: true });
}
