"use client";

/**
 * usePersistence
 *
 * - userId vem do Supabase Auth (session real)
 * - Fallback para UUID anónimo em localStorage se não autenticado
 * - Estado financeiro: localStorage imediato + Supabase em background
 * - Histórico de chat: localStorage imediato + Supabase completo
 */

import { useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import type { AppState, Transaction, Goal, FinancialStrategy } from "@/types";

// ── Obter userId real do Supabase Auth ───────────────────────
// Fallback para UUID anónimo se não autenticado (modo dev)

async function getUserId(): Promise<string> {
  try {
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return user.id;
  } catch {}

  // Fallback anónimo (só em desenvolvimento sem auth)
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("kuhula_user_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("kuhula_user_id", id);
  }
  return id;
}

// ── Tipos de acção atómica ────────────────────────────────────

export type PersistAction =
  | { action: "upsert_account";     payload: { name: string; balance: number } }
  | { action: "delete_account";     payload: { name: string } }
  | { action: "insert_transaction"; payload: { transaction: Transaction } }
  | { action: "delete_transaction"; payload: { id: string } }
  | { action: "upsert_goal";        payload: { goal: Goal } }
  | { action: "delete_goal";        payload: { title: string } }
  | { action: "upsert_budget_limit";payload: { category: string; limitAmount: number } }
  | { action: "upsert_strategy";    payload: { strategy: FinancialStrategy } }
  | { action: "delete_strategy";    payload: { id: string } }
  | { action: "clear_all";          payload: Record<string, never> };

// ── Tipos de mensagem de chat ─────────────────────────────────

export interface ChatMessageRecord {
  role: "user" | "model";
  content: string;
}

// ── Opções do hook ────────────────────────────────────────────

interface UsePersistenceOptions {
  onStateLoaded: (state: AppState) => void;
  onChatHistoryLoaded: (messages: ChatMessageRecord[]) => void;
}

// ── Hook ──────────────────────────────────────────────────────

export function usePersistence({ onStateLoaded, onChatHistoryLoaded }: UsePersistenceOptions) {
  const userIdRef = useRef<string>("");

  useEffect(() => {
    getUserId().then(id => {
      userIdRef.current = id;
      loadInitialState();
      loadChatHistory();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Estado financeiro ──────────────────────────────────────

  const loadInitialState = async () => {
    // 1. localStorage imediato
    const cached = localStorage.getItem("kuhula_state_v2");
    if (cached) {
      try { onStateLoaded(JSON.parse(cached)); } catch {}
    }

    // 2. DB em background — substitui se tiver dados
    try {
      const res = await fetch(`/api/state?userId=${userIdRef.current}`);
      if (res.ok) {
        const { state } = await res.json();
        if (state) {
          onStateLoaded(state);
          localStorage.setItem("kuhula_state_v2", JSON.stringify(state));
        }
      }
    } catch {}
  };

  const persistAction = useCallback(async (op: PersistAction, updatedState: AppState) => {
    localStorage.setItem("kuhula_state_v2", JSON.stringify(updatedState));
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current, ...op }),
      });
    } catch {}
  }, []);

  // ── Histórico de chat ──────────────────────────────────────

  const loadChatHistory = async () => {
    // 1. localStorage imediato
    const cached = localStorage.getItem("kuhula_chat_history");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Converte do formato ChatMessage (parts[]) para ChatMessageRecord (content)
        const records: ChatMessageRecord[] = parsed
          .filter((m: any) => (m.role === "user" || m.role === "model") && m.parts?.[0]?.text)
          .map((m: any) => ({ role: m.role, content: m.parts[0].text }));
        if (records.length) onChatHistoryLoaded(records);
      } catch {}
    }

    // 2. DB em background — fonte de verdade
    try {
      const res = await fetch(`/api/chat-history?userId=${userIdRef.current}&limit=100`);
      if (res.ok) {
        const { messages } = await res.json();
        if (messages?.length) {
          onChatHistoryLoaded(messages);
          // Actualiza localStorage com o histórico completo da DB
          const asChatMessages = messages.map((m: ChatMessageRecord) => ({
            role: m.role,
            parts: [{ text: m.content }],
          }));
          localStorage.setItem("kuhula_chat_history", JSON.stringify(asChatMessages));
        }
      }
    } catch {}
  };

  // Guarda TODAS as mensagens novas (não só as últimas 2)
  const persistChatMessages = useCallback(async (newMessages: ChatMessageRecord[]) => {
    if (!newMessages.length) return;
    try {
      await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current, messages: newMessages }),
      });
    } catch {}
  }, []);

  // ── Limpar tudo ────────────────────────────────────────────

  const clearRemoteData = useCallback(async () => {
    try {
      await Promise.all([
        fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userIdRef.current, action: "clear_all", payload: {} }),
        }),
        fetch("/api/chat-history", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userIdRef.current }),
        }),
      ]);
    } catch {}
  }, []);

  return {
    userId: userIdRef,
    persistAction,
    persistChatMessages,
    clearRemoteData,
  };
}
