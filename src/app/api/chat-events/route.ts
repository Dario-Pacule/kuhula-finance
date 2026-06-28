import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { events } = body;
  if (!Array.isArray(events) || events.length === 0) return NextResponse.json({ success: true });

  const rows = events.map((e: any) => ({
    session_id:        e.sessionId,
    user_id:           userId, // sempre do token, nunca do body
    event_type:        e.eventType,
    content:           e.content ?? null,
    tool_name:         e.toolName ?? null,
    tool_args:         e.toolArgs ?? null,
    tool_result:       e.toolResult ?? null,
    latency_ms:        e.latencyMs ?? null,
    prompt_tokens:     e.promptTokens ?? null,
    completion_tokens: e.completionTokens ?? null,
    provider:          e.provider ?? null,
    model:             e.model ?? null,
    error_code:        e.errorCode ?? null,
    error_message:     e.errorMessage ?? null,
    created_at:        e.createdAt,
  }));

  const { error } = await supabaseAdmin.from("chat_events").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const aiResponses = events.filter((e: any) => e.eventType === "ai_response");
  const promptSum = aiResponses.reduce((s: number, e: any) => s + (e.promptTokens ?? 0), 0);
  const completionSum = aiResponses.reduce((s: number, e: any) => s + (e.completionTokens ?? 0), 0);
  const msgCount = events.filter((e: any) => ["user_message", "ai_response"].includes(e.eventType)).length;

  if (msgCount > 0 || promptSum > 0) {
    await supabaseAdmin.rpc("increment_session_stats", {
      p_session_id: events[0].sessionId,
      p_message_count: msgCount,
      p_prompt_tokens: promptSum,
      p_completion_tokens: completionSum,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, inserted: rows.length });
}
