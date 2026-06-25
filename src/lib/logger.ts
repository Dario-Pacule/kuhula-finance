"use client";

/**
 * Logger global do Kuhula Finance
 *
 * Captura logs de todos os módulos e expõe via:
 * - useRuntimeLogs() hook para a UI
 * - log.info/warn/error/debug() para qualquer módulo
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEntry {
  id: number;
  ts: string;           // HH:MM:SS.mmm
  level: LogLevel;
  module: string;       // ex: "auth", "db", "ai", "persistence"
  message: string;
  data?: any;
}

// ── Store global (fora do React para ser acessível em qualquer módulo) ──

let _entries: LogEntry[] = [];
let _counter = 0;
const _listeners = new Set<(entries: LogEntry[]) => void>();

function notify() {
  const snapshot = [..._entries];
  _listeners.forEach(fn => fn(snapshot));
}

function addEntry(level: LogLevel, module: string, message: string, data?: any) {
  const now = new Date();
  const ts = now.toTimeString().slice(0, 8) + "." + String(now.getMilliseconds()).padStart(3, "0");

  const entry: LogEntry = { id: ++_counter, ts, level, module, message, data };
  _entries = [entry, ..._entries].slice(0, 200); // máx 200 entradas

  // Também imprime no console do browser para devtools
  const prefix = `[Kuhula:${module}]`;
  if (level === "error") console.error(prefix, message, data ?? "");
  else if (level === "warn")  console.warn(prefix, message, data ?? "");
  else if (level === "debug") console.debug(prefix, message, data ?? "");
  else                        console.log(prefix, message, data ?? "");

  notify();
}

// ── API pública ───────────────────────────────────────────────

export const log = {
  info:  (module: string, message: string, data?: any) => addEntry("info",  module, message, data),
  warn:  (module: string, message: string, data?: any) => addEntry("warn",  module, message, data),
  error: (module: string, message: string, data?: any) => addEntry("error", module, message, data),
  debug: (module: string, message: string, data?: any) => addEntry("debug", module, message, data),
  clear: () => { _entries = []; notify(); },
  getAll: () => [..._entries],
  copyToClipboard: () => {
    const text = _entries
      .slice()
      .reverse()
      .map(e => `[${e.ts}] ${e.level.toUpperCase().padEnd(5)} [${e.module}] ${e.message}${e.data !== undefined ? " " + JSON.stringify(e.data) : ""}`)
      .join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    return text;
  },
};

// ── Hook React ────────────────────────────────────────────────

import { useState, useEffect } from "react";

export function useRuntimeLogs() {
  const [entries, setEntries] = useState<LogEntry[]>(_entries);

  useEffect(() => {
    _listeners.add(setEntries);
    return () => { _listeners.delete(setEntries); };
  }, []);

  return { entries, clear: log.clear };
}
