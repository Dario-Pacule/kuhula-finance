import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { provider, model, sessionId } = body;

  if (!sessionId) return NextResponse.json({ error: "sessionId obrigatório" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("chat_sessions")
    .insert({
      id:       sessionId,
      user_id:  userId, // sempre do token
      provider: provider ?? "gemini",
      model:    model ?? "unknown",
    });

  if (error && !error.message.includes("duplicate")) {
    console.error("[chat-events/session]", error.message);
  }

  return NextResponse.json({ success: true });
}
