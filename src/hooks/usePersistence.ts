"use client";

import { useEffect, useRef, useCallback } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { log } from "@/lib/logger";
import type { AppState, Transaction, Goal, FinancialStrategy, UserProfile } from "@/types";

async function getUserId(): Promise<string> {
  try {
    const supabase = createBrowserClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) log.warn("auth", "getUser() error", error.message);
    if (user?.id) {
      log.info("auth", `Sessão activa`, { userId: user.id.slice(0,8)+"...", email: user.email });
      return user.id;
    }
    log.warn("auth", "Sem sessão — fallback para userId anónimo");
  } catch (e: any) {
    log.error("auth", "Excepção em getUser()", e?.message);
  }
  if (typeof window === "undefined") return "anon";
  let id = localStorage.getItem("kuhula_user_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("kuhula_user_id", id); }
  log.debug("auth", `userId anónimo: ${id.slice(0,8)}...`);
  return id;
}

export interface AiConfig {
  provider: string;
  model: string;
  apiKey: string;
  submitOnEnter: boolean;
}

export type PersistAction =
  | { action: "upsert_account";       payload: { name: string; balance: number } }
  | { action: "delete_account";       payload: { name: string } }
  | { action: "insert_transaction";   payload: { transaction: Transaction } }
  | { action: "delete_transaction";   payload: { id: string } }
  | { action: "upsert_goal";          payload: { goal: Goal } }
  | { action: "delete_goal";          payload: { title: string } }
  | { action: "upsert_budget_limit";  payload: { category: string; limitAmount: number } }
  | { action: "upsert_strategy";      payload: { strategy: FinancialStrategy } }
  | { action: "delete_strategy";      payload: { id: string } }
  | { action: "update_user_profile";  payload: { profile: Partial<UserProfile> } }
  | { action: "clear_all";            payload: Record<string, never> };

export interface ChatMessageRecord {
  role: "user" | "model";
  content: string;
}

export type SyncStatus = "syncing" | "synced" | "error";

interface UsePersistenceOptions {
  onStateLoaded: (state: AppState) => void;
  onChatHistoryLoaded: (messages: ChatMessageRecord[]) => void;
  onAiConfigLoaded: (config: AiConfig) => void;
  onSyncStatusChange?: (status: SyncStatus) => void;
  onChatHistoryLoadComplete?: () => void;
}

export function usePersistence({
  onStateLoaded,
  onChatHistoryLoaded,
  onAiConfigLoaded,
  onSyncStatusChange,
  onChatHistoryLoadComplete
}: UsePersistenceOptions) {
  const userIdRef = useRef<string>("");
  const activeRequests = useRef(0);
  const hasError = useRef(false);

  const startSync = useCallback(() => {
    if (activeRequests.current === 0) {
      hasError.current = false;
      onSyncStatusChange?.("syncing");
    }
    activeRequests.current++;
  }, [onSyncStatusChange]);

  const endSync = useCallback((success: boolean) => {
    activeRequests.current = Math.max(0, activeRequests.current - 1);
    if (!success) {
      hasError.current = true;
    }
    if (activeRequests.current === 0) {
      onSyncStatusChange?.(hasError.current ? "error" : "synced");
    }
  }, [onSyncStatusChange]);

  useEffect(() => {
    getUserId().then(id => {
      userIdRef.current = id;
      loadInitialState();
      loadChatHistory();
      loadAiConfig();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Estado financeiro ────────────────────────────────────────

  const loadInitialState = async () => {
    const cached = localStorage.getItem("kuhula_state_v2");
    if (cached) {
      try { onStateLoaded(JSON.parse(cached)); log.debug("persistence", "Estado carregado do localStorage"); }
      catch (e: any) { log.warn("persistence", "Erro ao ler estado do localStorage", e?.message); }
    }
    startSync();
    let success = false;
    try {
      log.info("persistence", `GET /api/state userId=${userIdRef.current.slice(0,8)}...`);
      const res = await fetch(`/api/state?userId=${userIdRef.current}`);
      log.info("persistence", `GET /api/state → ${res.status}`);
      if (res.ok) {
        const { state, error } = await res.json();
        if (error) { log.error("persistence", "Erro da API state", error); return; }
        if (state) {
          onStateLoaded(state);
          localStorage.setItem("kuhula_state_v2", JSON.stringify(state));
          log.info("persistence", "Estado carregado da DB", { contas: Object.keys(state.accounts ?? {}), txs: state.transactions?.length });
        } else {
          log.info("persistence", "DB não tem estado — utilizador novo ou sem dados");
        }
        success = true;
      } else {
        const body = await res.text();
        log.error("persistence", `GET /api/state falhou ${res.status}`, body);
      }
    } catch (e: any) {
      log.error("persistence", "Excepção em loadInitialState", e?.message);
    } finally {
      endSync(success);
    }
  };

  const persistAction = useCallback(async (op: PersistAction, updatedState: AppState) => {
    localStorage.setItem("kuhula_state_v2", JSON.stringify(updatedState));
    log.info("persistence", `persistAction: ${op.action}`);
    startSync();
    let success = false;
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current, ...op }),
      });
      const body = await res.json();
      if (!res.ok || body.error) log.error("persistence", `persistAction ${op.action} falhou`, body.error);
      else {
        log.debug("persistence", `persistAction ${op.action} OK`);
        success = true;
      }
    } catch (e: any) {
      log.error("persistence", `Excepção em persistAction ${op.action}`, e?.message);
    } finally {
      endSync(success);
    }
  }, [startSync, endSync]);

  // ── Config de IA ─────────────────────────────────────────────

  const loadAiConfig = async () => {
    const cached = localStorage.getItem("kuhula_ai_config");
    if (cached) {
      try {
        const config = JSON.parse(cached);
        onAiConfigLoaded(config);
        log.debug("ai-config", "Config carregada do localStorage", { provider: config.provider, model: config.model, hasKey: !!config.apiKey });
      } catch (e: any) { log.warn("ai-config", "Erro ao ler config do localStorage", e?.message); }
    }
    startSync();
    let success = false;
    try {
      log.info("ai-config", `GET /api/ai-config userId=${userIdRef.current.slice(0,8)}...`);
      const res = await fetch(`/api/ai-config?userId=${userIdRef.current}`);
      log.info("ai-config", `GET /api/ai-config → ${res.status}`);
      if (res.ok) {
        const { config, error } = await res.json();
        if (error) { log.error("ai-config", "Erro da API ai-config", error); return; }
        if (config?.provider) {
          onAiConfigLoaded(config);
          localStorage.setItem("kuhula_ai_config", JSON.stringify(config));
          log.info("ai-config", "Config carregada da DB", { provider: config.provider, model: config.model, hasKey: !!config.apiKey });
        } else {
          log.warn("ai-config", "DB não tem config de IA — utilizador ainda não configurou");
        }
        success = true;
      } else {
        const body = await res.text();
        log.error("ai-config", `GET /api/ai-config falhou ${res.status}`, body);
      }
    } catch (e: any) {
      log.error("ai-config", "Excepção em loadAiConfig", e?.message);
    } finally {
      endSync(success);
    }
  };

  const saveAiConfig = useCallback(async (config: AiConfig) => {
    localStorage.setItem("kuhula_ai_config", JSON.stringify(config));
    log.info("ai-config", "A guardar config na DB", { provider: config.provider, model: config.model, hasKey: !!config.apiKey });
    startSync();
    let success = false;
    try {
      const res = await fetch("/api/ai-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current, ...config }),
      });
      const body = await res.json();
      if (!res.ok || body.error) log.error("ai-config", `saveAiConfig falhou ${res.status}`, body.error);
      else {
        log.info("ai-config", "Config guardada na DB com sucesso");
        success = true;
      }
    } catch (e: any) {
      log.error("ai-config", "Excepção em saveAiConfig", e?.message);
    } finally {
      endSync(success);
    }
  }, [startSync, endSync]);

  // ── Histórico de chat ─────────────────────────────────────────

  const loadChatHistory = async () => {
    const cached = localStorage.getItem("kuhula_chat_history");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const records: ChatMessageRecord[] = parsed
          .filter((m: any) => (m.role === "user" || m.role === "model") && m.parts?.[0]?.text)
          .map((m: any) => ({ role: m.role, content: m.parts[0].text }));
        if (records.length) {
          onChatHistoryLoaded(records);
          log.debug("chat", `${records.length} mensagens carregadas do localStorage`);
        }
      } catch {}
    }
    startSync();
    let success = false;
    try {
      log.info("chat", `GET /api/chat-history userId=${userIdRef.current.slice(0,8)}...`);
      const res = await fetch(`/api/chat-history?userId=${userIdRef.current}&limit=100`);
      log.info("chat", `GET /api/chat-history → ${res.status}`);
      if (res.ok) {
        const { messages } = await res.json();
        if (messages?.length) {
          onChatHistoryLoaded(messages);
          const asChatMessages = messages.map((m: ChatMessageRecord) => ({ role: m.role, parts: [{ text: m.content }] }));
          localStorage.setItem("kuhula_chat_history", JSON.stringify(asChatMessages));
          log.info("chat", `${messages.length} mensagens carregadas da DB`);
        } else {
          log.debug("chat", "Sem histórico de chat na DB");
        }
        success = true;
      } else {
        log.error("chat", `GET /api/chat-history falhou ${res.status}`);
      }
    } catch (e: any) {
      log.error("chat", "Excepção em loadChatHistory", e?.message);
    } finally {
      endSync(success);
      onChatHistoryLoadComplete?.();
    }
  };

  const persistChatMessages = useCallback(async (newMessages: ChatMessageRecord[]) => {
    if (!newMessages.length) return;
    startSync();
    let success = false;
    try {
      const res = await fetch("/api/chat-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userIdRef.current, messages: newMessages }),
      });
      if (!res.ok) log.warn("chat", `persistChatMessages falhou ${res.status}`);
      else {
        log.debug("chat", `${newMessages.length} mensagens guardadas na DB`);
        success = true;
      }
    } catch (e: any) {
      log.error("chat", "Excepção em persistChatMessages", e?.message);
    } finally {
      endSync(success);
    }
  }, [startSync, endSync]);

  // ── Limpar tudo ───────────────────────────────────────────────

  const clearRemoteData = useCallback(async () => {
    log.info("persistence", "A limpar todos os dados do utilizador...");
    startSync();
    let success = false;
    try {
      await Promise.all([
        fetch("/api/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userIdRef.current, action: "clear_all", payload: {} }) }),
        fetch("/api/chat-history", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userIdRef.current }) }),
      ]);
      log.info("persistence", "Dados apagados com sucesso");
      success = true;
    } catch (e: any) {
      log.error("persistence", "Erro ao limpar dados", e?.message);
    } finally {
      endSync(success);
    }
  }, [startSync, endSync]);

  return { userId: userIdRef, persistAction, persistChatMessages, saveAiConfig, clearRemoteData };
}
