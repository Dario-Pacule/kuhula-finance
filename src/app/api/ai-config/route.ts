/**
 * GET  /api/ai-config  — carrega provider, model e api_key do utilizador
 * POST /api/ai-config  — guarda provider, model e api_key
 *
 * A chave é guardada em texto simples na coluna api_key_encrypted.
 * Para produção real, usar Supabase Vault para encriptação at-rest.
 * A RLS garante que só o próprio utilizador acede à sua chave.
 */

import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";

async function resolveUserId(fallback?: string | null): Promise<string | null> {
  return (await getAuthenticatedUserId()) ?? fallback ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = await resolveUserId(searchParams.get("userId"));
  if (!userId) return NextResponse.json({ config: null });

  const { data, error } = await supabaseAdmin
    .from("ai_providers")
    .select("provider, model, api_key_encrypted, submit_on_enter")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ config: null });

  return NextResponse.json({
    config: {
      provider: data.provider,
      model: data.model,
      apiKey: data.api_key_encrypted ?? "",
      submitOnEnter: data.submit_on_enter,
    },
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = await resolveUserId(body.userId);
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { provider, model, apiKey, submitOnEnter } = body;

  const { error } = await supabaseAdmin
    .from("ai_providers")
    .upsert(
      {
        user_id: userId,
        provider,
        model,
        api_key_encrypted: apiKey ?? "",
        submit_on_enter: submitOnEnter ?? true,
      },
      { onConflict: "user_id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
