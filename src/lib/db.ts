/**
 * Kuhula Finance — Camada de Acesso a Dados (Supabase / PostgreSQL)
 *
 * Todas as operações de DB passam por aqui. O resto da app
 * nunca importa o cliente Supabase directamente.
 */

import { supabaseAdmin } from "./supabase";
import type { AppState, Transaction, Goal, FinancialStrategy, UserProfile } from "@/types";

// ─────────────────────────────────────────────
// TIPOS INTERNOS DA DB
// ─────────────────────────────────────────────

interface DbAccount {
  id: string;
  user_id: string;
  name: string;
  balance: number;
  type: "bank" | "wallet";
}

interface DbTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  account_name: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  is_recurring: boolean;
  day_of_month: number | null;
  date: string;
}

interface DbGoal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
}

interface DbBudgetLimit {
  id: string;
  user_id: string;
  category: string;
  limit_amount: number;
}

interface DbStrategy {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: "info" | "warning" | "success" | "critical";
  action_label: string | null;
  frequency: "daily" | "weekly" | "monthly" | "one-time" | null;
}

interface DbUserProfile {
  user_id: string;
  profile_json: UserProfile;
  updated_at: string;
}

// ─────────────────────────────────────────────
// LOAD — lê todo o estado do utilizador da DB
// ─────────────────────────────────────────────

export async function loadUserState(userId: string): Promise<AppState | null> {
  const [accounts, transactions, goals, budgetLimits, strategies, profileResult] =
    await Promise.all([
      supabaseAdmin
        .from("accounts")
        .select("*")
        .eq("user_id", userId)
        .order("name"),
      supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("goals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at"),
      supabaseAdmin
        .from("budget_limits")
        .select("*")
        .eq("user_id", userId),
      supabaseAdmin
        .from("strategies")
        .select("*")
        .eq("user_id", userId)
        .order("created_at"),
      supabaseAdmin
        .from("user_profiles")
        .select("profile_json")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  // Se qualquer query falhou, retorna null para o frontend usar o localStorage
  if (
    accounts.error ||
    transactions.error ||
    goals.error ||
    budgetLimits.error ||
    strategies.error
  ) {
    console.error("loadUserState errors:", {
      accounts: accounts.error,
      transactions: transactions.error,
      goals: goals.error,
      budgetLimits: budgetLimits.error,
      strategies: strategies.error,
    });
    return null;
  }

  // Mapear para o formato AppState usado pela app
  const accountsMap: Record<string, number> = {};
  for (const acc of (accounts.data as DbAccount[]) ?? []) {
    accountsMap[acc.name] = acc.balance;
  }

  const budgetMap: Record<string, number> = {};
  for (const bl of (budgetLimits.data as DbBudgetLimit[]) ?? []) {
    budgetMap[bl.category] = bl.limit_amount;
  }

  return {
    accounts: accountsMap,
    transactions: ((transactions.data as DbTransaction[]) ?? []).map((t) => ({
      id: t.id,
      description: t.description,
      amount: t.amount,
      type: t.type,
      category: t.category,
      account: t.account_name,
      date: t.date,
      isRecurring: t.is_recurring,
      dayOfMonth: t.day_of_month,
    })),
    goals: ((goals.data as DbGoal[]) ?? []).map((g) => ({
      title: g.title,
      targetAmount: g.target_amount,
      currentAmount: g.current_amount,
      deadline: g.deadline ?? "",
    })),
    budgetLimits: budgetMap,
    strategies: ((strategies.data as DbStrategy[]) ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      type: s.type,
      actionLabel: s.action_label ?? undefined,
      frequency: s.frequency ?? undefined,
    })),
    userProfile: (profileResult.data as DbUserProfile | null)?.profile_json ?? undefined,
  };
}

// ─────────────────────────────────────────────
// UPSERT ACCOUNT
// ─────────────────────────────────────────────

export async function upsertAccount(
  userId: string,
  name: string,
  balance: number
) {
  const walletNames = ["m-pesa", "e-mola", "mkesh", "carteira"];
  const type = walletNames.includes(name.toLowerCase()) ? "wallet" : "bank";

  const { error } = await supabaseAdmin
    .from("accounts")
    .upsert(
      { user_id: userId, name, balance, type },
      { onConflict: "user_id,name" }
    );

  if (error) throw error;
}

// ─────────────────────────────────────────────
// DELETE ACCOUNT
// ─────────────────────────────────────────────

export async function deleteAccount(userId: string, name: string) {
  const { error } = await supabaseAdmin
    .from("accounts")
    .delete()
    .eq("user_id", userId)
    .eq("name", name);

  if (error) throw error;
}

// ─────────────────────────────────────────────
// INSERT TRANSACTION
// ─────────────────────────────────────────────

export async function insertTransaction(
  userId: string,
  tx: Omit<Transaction, "id"> & { id?: string }
) {
  // Obtém o account_id pelo nome (pode ser null se a conta não existir)
  const { data: accData } = await supabaseAdmin
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", tx.account)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      id: tx.id,
      user_id: userId,
      account_id: accData?.id ?? null,
      account_name: tx.account,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category,
      is_recurring: tx.isRecurring,
      day_of_month: tx.dayOfMonth ?? null,
      date: tx.date,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

// ─────────────────────────────────────────────
// DELETE TRANSACTION
// ─────────────────────────────────────────────

export async function deleteTransaction(userId: string, txId: string) {
  const { error } = await supabaseAdmin
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("id", txId);

  if (error) throw error;
}

// ─────────────────────────────────────────────
// UPSERT GOAL
// ─────────────────────────────────────────────

export async function upsertGoal(userId: string, goal: Goal) {
  const { error } = await supabaseAdmin
    .from("goals")
    .upsert(
      {
        user_id: userId,
        title: goal.title,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        deadline: goal.deadline || null,
      },
      { onConflict: "user_id,title" }
    );

  if (error) throw error;
}

// ─────────────────────────────────────────────
// DELETE GOAL
// ─────────────────────────────────────────────

export async function deleteGoal(userId: string, title: string) {
  const { error } = await supabaseAdmin
    .from("goals")
    .delete()
    .eq("user_id", userId)
    .ilike("title", title);

  if (error) throw error;
}

// ─────────────────────────────────────────────
// UPSERT BUDGET LIMIT
// ─────────────────────────────────────────────

export async function upsertBudgetLimit(
  userId: string,
  category: string,
  limitAmount: number
) {
  const { error } = await supabaseAdmin
    .from("budget_limits")
    .upsert(
      { user_id: userId, category, limit_amount: limitAmount },
      { onConflict: "user_id,category" }
    );

  if (error) throw error;
}

// ─────────────────────────────────────────────
// UPSERT STRATEGY
// ─────────────────────────────────────────────

export async function upsertStrategy(
  userId: string,
  strategy: FinancialStrategy
) {
  const { error } = await supabaseAdmin
    .from("strategies")
    .upsert(
      {
        id: strategy.id,
        user_id: userId,
        title: strategy.title,
        description: strategy.description,
        type: strategy.type,
        action_label: strategy.actionLabel ?? null,
        frequency: strategy.frequency ?? null,
      },
      { onConflict: "user_id,id" }
    );

  if (error) throw error;
}

// ─────────────────────────────────────────────
// DELETE STRATEGY
// ─────────────────────────────────────────────

export async function deleteStrategy(userId: string, strategyId: string) {
  const { error } = await supabaseAdmin
    .from("strategies")
    .delete()
    .eq("user_id", userId)
    .eq("id", strategyId);

  if (error) throw error;
}

// ─────────────────────────────────────────────
// CHAT SESSIONS & HISTORY
// ─────────────────────────────────────────────

export async function loadChatSessions(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function createChatSession(userId: string, title: string = "Nova Conversa"): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .insert({ user_id: userId, title })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function renameChatSession(userId: string, sessionId: string, newTitle: string) {
  const { error } = await supabaseAdmin
    .from("chat_threads")
    .update({ title: newTitle, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", sessionId);

  if (error) throw error;
}

export async function saveChatMessages(
  userId: string,
  sessionId: string,
  messages: Array<{ role: "user" | "model"; content: string }>
) {
  if (!messages.length) return;

  const { error } = await supabaseAdmin.from("chat_messages").insert(
    messages.map((m) => ({
      user_id: userId,
      session_id: sessionId,
      role: m.role,
      content: m.content,
    }))
  );

  if (error) throw error;

  // Atualizar o updated_at da sessão
  await supabaseAdmin
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);
}

export async function loadChatHistory(
  userId: string,
  sessionId: string,
  limit = 60
): Promise<Array<{ role: "user" | "model"; content: string }>> {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data ?? []).reverse() as Array<{
    role: "user" | "model";
    content: string;
  }>;
}

export async function clearChatHistory(userId: string, sessionId: string) {
  // Se apagarmos a sessão, as mensagens são apagadas em cascata
  await supabaseAdmin
    .from("chat_threads")
    .delete()
    .eq("user_id", userId)
    .eq("id", sessionId);
}

// ─────────────────────────────────────────────
// USER PROFILE
// ─────────────────────────────────────────────

export async function upsertUserProfile(
  userId: string,
  profile: Partial<UserProfile>
) {
  // Merge com o perfil existente para não sobrescrever campos não enviados
  const { data: existing } = await supabaseAdmin
    .from("user_profiles")
    .select("profile_json")
    .eq("user_id", userId)
    .maybeSingle();

  const merged: UserProfile = {
    ...(existing?.profile_json ?? {}),
    ...profile,
    lastUpdated: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("user_profiles")
    .upsert(
      { user_id: userId, profile_json: merged, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) throw error;
  return merged;
}

// ─────────────────────────────────────────────
// AI PROVIDER CONFIG
// ─────────────────────────────────────────────

export async function loadAiProviderConfig(userId: string) {
  const { data } = await supabaseAdmin
    .from("ai_providers")
    .select("provider, model, submit_on_enter")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

export async function saveAiProviderConfig(
  userId: string,
  config: { provider: string; model: string; submitOnEnter: boolean }
) {
  const { error } = await supabaseAdmin
    .from("ai_providers")
    .upsert(
      {
        user_id: userId,
        provider: config.provider,
        model: config.model,
        submit_on_enter: config.submitOnEnter,
      },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}
