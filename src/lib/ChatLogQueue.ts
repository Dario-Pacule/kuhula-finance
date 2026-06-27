"use client";

/**
 * ChatLogQueue
 *
 * Fila local de eventos de chat com:
 * - Escrita imediata em memória (zero latência para o utilizador)
 * - Backup em localStorage (resiliência offline)
 * - Flush em batch a cada 5s via worker
 * - Retry com backoff exponencial (3 tentativas)
 * - Fire-and-forget: nunca bloqueia o chat
 */

export type ChatEventType =
  | "user_message"
  | "ai_response"
  | "ai_error"
  | "tool_call"
  | "tool_confirmed"
  | "tool_cancelled"
  | "tool_input"
  | "tool_answered";

export interface ChatEvent {
  // Identificação
  sessionId: string;
  userId: string;
  eventType: ChatEventType;

  // Conteúdo
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: Record<string, any>;

  // Performance
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  provider?: string;
  model?: string;

  // Erros
  errorCode?: string;
  errorMessage?: string;

  // Timestamp local (antes de ir para DB)
  createdAt: string;
}

// ── Constantes ────────────────────────────────────────────────

const STORAGE_KEY = "kuhula_log_queue";
const FLUSH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [1_000, 3_000, 10_000];

// ── Store em memória ──────────────────────────────────────────

let _queue: ChatEvent[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _isFlushing = false;
let _sessionId: string | null = null;
let _userId: string | null = null;

// ── Inicialização ─────────────────────────────────────────────

export function initChatLogQueue(userId: string, provider: string, model: string): string {
  _userId = userId;

  // Gera um sessionId para esta sessão de browser
  _sessionId = crypto.randomUUID();

  // Recupera eventos pendentes do localStorage (de sessões anteriores)
  _restoreFromStorage();

  // Inicia o worker de flush
  if (_flushTimer) clearInterval(_flushTimer);
  _flushTimer = setInterval(_flush, FLUSH_INTERVAL_MS);

  // Regista a sessão na DB
  _registerSession(userId, provider, model, _sessionId);

  return _sessionId;
}

export function getChatSessionId(): string | null {
  return _sessionId;
}

// ── Push de evento ────────────────────────────────────────────

export function pushChatEvent(event: Omit<ChatEvent, "sessionId" | "userId" | "createdAt">) {
  if (!_sessionId || !_userId) return;

  const fullEvent: ChatEvent = {
    ...event,
    sessionId: _sessionId,
    userId: _userId,
    createdAt: new Date().toISOString(),
  };

  _queue.push(fullEvent);
  _persistToStorage();
}

// ── Flush ─────────────────────────────────────────────────────

async function _flush() {
  if (_isFlushing || _queue.length === 0) return;
  _isFlushing = true;

  const batch = _queue.splice(0, MAX_BATCH_SIZE);

  let success = false;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/chat-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
      });

      if (res.ok) {
        success = true;
        break;
      }

      // Aguarda antes de retry
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    } catch {
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
  }

  if (!success) {
    // Devolve os eventos à fila para tentar depois
    _queue = [...batch, ..._queue];
  }

  _persistToStorage();
  _isFlushing = false;
}

// Flush imediato (ex: ao fechar a app)
export function flushNow(): Promise<void> {
  return _flush();
}

// ── localStorage ──────────────────────────────────────────────

function _persistToStorage() {
  try {
    if (_queue.length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      // Guarda máximo 100 eventos para não encher o localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_queue.slice(0, 100)));
    }
  } catch {}
}

function _restoreFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const events: ChatEvent[] = JSON.parse(saved);
      _queue = [...events, ..._queue];
      console.log(`[ChatLogQueue] ${events.length} eventos restaurados do localStorage`);
    }
  } catch {}
}

// ── Registar sessão na DB ─────────────────────────────────────

async function _registerSession(userId: string, provider: string, model: string, sessionId: string) {
  try {
    await fetch("/api/chat-events/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, provider, model, sessionId }),
    });
  } catch {
    // Silencioso — não é crítico
  }
}
