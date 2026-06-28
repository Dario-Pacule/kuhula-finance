import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/auth-server";
import {
  loadUserState, upsertAccount, deleteAccount,
  insertTransaction, deleteTransaction, upsertGoal, deleteGoal,
  upsertBudgetLimit, upsertStrategy, deleteStrategy,
} from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const state = await loadUserState(userId);
    return NextResponse.json({ state });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

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
      case "clear_all": {
        const now = new Date().toISOString();
        await Promise.all([
          supabaseAdmin.from("transactions").update({ status: "deleted" }).eq("user_id", userId),
          supabaseAdmin.from("accounts").update({ status: "deleted", archived_at: now }).eq("user_id", userId),
          supabaseAdmin.from("goals").update({ status: "deleted", archived_at: now }).eq("user_id", userId),
          supabaseAdmin.from("strategies").update({ status: "deleted", archived_at: now }).eq("user_id", userId),
          supabaseAdmin.from("chat_sessions").update({ status: "deleted", archived_at: now }).eq("user_id", userId),
          supabaseAdmin.from("chat_messages").update({ status: "deleted" }).eq("user_id", userId),
        ]);
        break;
      }
      default:
        return NextResponse.json({ error: `Acção desconhecida: ${action}` }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[state API] action=${action}`, err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
