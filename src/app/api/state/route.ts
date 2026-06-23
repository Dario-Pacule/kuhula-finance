/**
 * GET  /api/state?userId=xxx  — carrega o estado do utilizador
 * POST /api/state             — aplica uma operação atómica (não mais blobs)
 *
 * O body do POST segue o padrão Command:
 * { userId, action, payload }
 *
 * Acções disponíveis:
 *   upsert_account | delete_account
 *   insert_transaction | delete_transaction
 *   upsert_goal | delete_goal
 *   upsert_budget_limit
 *   upsert_strategy | delete_strategy
 *   clear_all
 */

import { NextResponse } from "next/server";
import {
  loadUserState,
  upsertAccount,
  deleteAccount,
  insertTransaction,
  deleteTransaction,
  upsertGoal,
  deleteGoal,
  upsertBudgetLimit,
  upsertStrategy,
  deleteStrategy,
} from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase";

// ── GET ─────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const state = await loadUserState(userId);
    return NextResponse.json({ state });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Failed to load state" },
      { status: 500 }
    );
  }
}

// ── POST ────────────────────────────────────────────────────
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, action, payload } = body;

  if (!userId || !action) {
    return NextResponse.json(
      { error: "userId and action are required" },
      { status: 400 }
    );
  }

  try {
    switch (action) {
      case "upsert_account":
        await upsertAccount(userId, payload.name, payload.balance);
        break;

      case "delete_account":
        await deleteAccount(userId, payload.name);
        break;

      case "insert_transaction":
        await insertTransaction(userId, payload.transaction);
        break;

      case "delete_transaction":
        await deleteTransaction(userId, payload.id);
        break;

      case "upsert_goal":
        await upsertGoal(userId, payload.goal);
        break;

      case "delete_goal":
        await deleteGoal(userId, payload.title);
        break;

      case "upsert_budget_limit":
        await upsertBudgetLimit(userId, payload.category, payload.limitAmount);
        break;

      case "upsert_strategy":
        await upsertStrategy(userId, payload.strategy);
        break;

      case "delete_strategy":
        await deleteStrategy(userId, payload.id);
        break;

      case "clear_all": {
        // Apaga todos os dados do utilizador em cascata via FK
        await Promise.all([
          supabaseAdmin.from("transactions").delete().eq("user_id", userId),
          supabaseAdmin.from("accounts").delete().eq("user_id", userId),
          supabaseAdmin.from("goals").delete().eq("user_id", userId),
          supabaseAdmin.from("budget_limits").delete().eq("user_id", userId),
          supabaseAdmin.from("strategies").delete().eq("user_id", userId),
          supabaseAdmin.from("chat_messages").delete().eq("user_id", userId),
        ]);
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`[state API] action=${action}`, err);
    return NextResponse.json(
      { error: err.message ?? "Operation failed" },
      { status: 500 }
    );
  }
}
