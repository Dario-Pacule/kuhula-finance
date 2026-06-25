import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import {
  loadUserState, upsertAccount, deleteAccount,
  insertTransaction, deleteTransaction, upsertGoal, deleteGoal,
  upsertBudgetLimit, upsertStrategy, deleteStrategy,
} from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// Resolve userId: session real > fallback do body (dev sem auth)
async function resolveUserId(body?: any): Promise<string | null> {
  const sessionId = await getAuthenticatedUserId();
  if (sessionId) return sessionId;
  // Fallback para desenvolvimento local sem auth configurado
  return body?.userId ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = await resolveUserId({ userId: searchParams.get("userId") });
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const state = await loadUserState(userId);
    return NextResponse.json({ state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const userId = await resolveUserId(body);
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { action, payload } = body;
  if (!action) return NextResponse.json({ error: "action obrigatório" }, { status: 400 });

  try {
    switch (action) {
      case "upsert_account":       await upsertAccount(userId, payload.name, payload.balance); break;
      case "delete_account":       await deleteAccount(userId, payload.name); break;
      case "insert_transaction":   await insertTransaction(userId, payload.transaction); break;
      case "delete_transaction":   await deleteTransaction(userId, payload.id); break;
      case "upsert_goal":          await upsertGoal(userId, payload.goal); break;
      case "delete_goal":          await deleteGoal(userId, payload.title); break;
      case "upsert_budget_limit":  await upsertBudgetLimit(userId, payload.category, payload.limitAmount); break;
      case "upsert_strategy":      await upsertStrategy(userId, payload.strategy); break;
      case "delete_strategy":      await deleteStrategy(userId, payload.id); break;
      case "clear_all":
        await Promise.all([
          supabaseAdmin.from("transactions").delete().eq("user_id", userId),
          supabaseAdmin.from("accounts").delete().eq("user_id", userId),
          supabaseAdmin.from("goals").delete().eq("user_id", userId),
          supabaseAdmin.from("budget_limits").delete().eq("user_id", userId),
          supabaseAdmin.from("strategies").delete().eq("user_id", userId),
          supabaseAdmin.from("chat_messages").delete().eq("user_id", userId),
        ]);
        break;
      default:
        return NextResponse.json({ error: `Acção desconhecida: ${action}` }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[state API] action=${action}`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
