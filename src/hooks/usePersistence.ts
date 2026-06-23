"use client";

/**
 * usePersistence
 *
 * Hook que abstrai toda a lógica de persistência da app:
 * - Carrega estado inicial da DB (com fallback para localStorage)
 * - Expõe `persistAction` para operações atómicas (insert tx, upsert goal, etc.)
 * - Sincroniza automaticamente com a DB em background
 *
 * O `userId` é gerado no primeiro acesso e guardado em localStorage.
 * Quando autenticação for adicionada, basta trocar esta linha pelo
 * ID real do utilizador autenticado.
 */

import { useEffect, useRef, useCallback } from "react";
import type { AppState, Transaction, Goal, FinancialStrategy } from "@/types";

// ── Gerar/obter userId anónimo ───────────────────────────────

function getAnonymousUserId(): string {
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("kuhula_user_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("kuhula_user_id", id);
  }
  return id;
}

// ── Tipos de acção ───────────────────────────────────────────

export type PersistAction =
  | { action: "upsert_account";    payload: { name: string; balance: number } }
  | { action: "delete_account";    payload: { name: string } }
  | { action: "insert_transaction";payload: { transaction: Transaction } }
  | { action: "delete_transaction";payload: { id: string } }
  | { action: "upsert_goal";       payload: { goal: Goal } }
  | { action: "delete_goal";       payload: { title: string } }
  | { action: "upsert_budget_limit";payload: { category: string; limitAmount: number } }
  | { action: "upsert_strategy";   payload: { strategy: FinancialStrategy } }
  | { action: "delete_strategy";   payload: { id: string } }
  | { action: "clear_all";         payload: Record<string, never> };

// ── Hook ─────────────────────────────────────────────────────

interface UsePersistenceOptions {
  onStateLoaded: (state: AppState) => void;
}

export function usePersistence({ onStateLoaded }: UsePersistenceOptions) {
  const userIdRef = useRef<string>("");

  // Inicializa userId e carrega estado
  useEffect(() => {
    userIdRef.current = getAnonymousUserId();
    loadInitialState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialState = async () => {
    // 1. Carrega localStorage imediatamente (zero latência)
    const cached = localStorage.getItem("kuhula_state_v2");
    if (cached) {
      try {
        onStateLoaded(JSON.parse(cached));
      } catch {}
    }

    // 2. Carrega DB em background e actualiza se houver dados mais recentes
    try {
      const res = await fetch(`/api/state?userId=${userIdRef.current}`);
      if (res.ok) {
        const { state } = await res.json();
        if (state) {
          onStateLoaded(state);
          localStorage.setItem("kuhula_state_v2", JSON.stringify(state));
        }
      }
    } catch {
      // DB indisponível — continua com localStorage
    }
  };

  // Persiste uma acção atómica: localStorage imediato + DB em background
  const persistAction = useCallback(
    async (op: PersistAction, updatedState: AppState) => {
      // Actualiza localStorage de imediato
      localStorage.setItem("kuhula_state_v2", JSON.stringify(updatedState));

      // Envia para a DB em background (não bloqueia a UI)
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdRef.current,
            ...op,
          }),
        });
      } catch {
        // Falha silenciosa — o localStorage já tem os dados
      }
    },
    []
  );

  // Persiste mensagens de chat na DB
  const persistChatMessages = useCallback(
    async (messages: Array<{ role: "user" | "model"; content: string }>) => {
      if (!messages.length) return;
      try {
        await fetch("/api/chat-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: userIdRef.current,
            messages,
          }),
        });
      } catch {}
    },
    []
  );

  const clearRemoteData = useCallback(async () => {
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userIdRef.current,
          action: "clear_all",
          payload: {},
        }),
      });
      await fetch("/api/chat-history", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current }),
      });
    } catch {}
  }, []);

  return {
    userId: userIdRef,
    persistAction,
    persistChatMessages,
    clearRemoteData,
  };
}
