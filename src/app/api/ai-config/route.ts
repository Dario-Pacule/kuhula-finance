import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const userId = await getAuthenticatedUserId();
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
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
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
