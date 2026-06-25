"use client";

import { useRuntimeLogs, type LogEntry } from "@/lib/logger";

const LEVEL_STYLES: Record<string, string> = {
  info:  "text-zinc-300",
  debug: "text-zinc-500",
  warn:  "text-yellow-400",
  error: "text-red-400",
};

const LEVEL_BG: Record<string, string> = {
  info:  "",
  debug: "",
  warn:  "bg-yellow-950/20",
  error: "bg-red-950/20 border-l border-red-900/50",
};

const MODULE_COLORS: Record<string, string> = {
  auth:        "text-blue-400",
  persistence: "text-emerald-400",
  "ai-config": "text-purple-400",
  chat:        "text-orange-400",
  ai:          "text-pink-400",
};

function LogRow({ entry }: { entry: LogEntry }) {
  const moduleColor = MODULE_COLORS[entry.module] ?? "text-zinc-400";
  return (
    <div className={`flex gap-2 px-2 py-1 text-[10px] font-mono leading-relaxed ${LEVEL_BG[entry.level]}`}>
      <span className="text-zinc-600 shrink-0">{entry.ts}</span>
      <span className={`shrink-0 w-[10px] font-bold ${LEVEL_STYLES[entry.level]}`}>
        {entry.level === "error" ? "✕" : entry.level === "warn" ? "⚠" : entry.level === "debug" ? "·" : "›"}
      </span>
      <span className={`shrink-0 ${moduleColor}`}>[{entry.module}]</span>
      <span className={LEVEL_STYLES[entry.level]}>{entry.message}</span>
      {entry.data !== undefined && (
        <span className="text-zinc-600 truncate max-w-[160px]">
          {typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data)}
        </span>
      )}
    </div>
  );
}

export function RuntimeLogsPanel() {
  const { entries, clear } = useRuntimeLogs();

  const errors   = entries.filter(e => e.level === "error").length;
  const warnings = entries.filter(e => e.level === "warn").length;

  return (
    <div className="flex flex-col h-[280px]">
      {/* Barra de estado */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-3 text-[9px]">
          <span className="text-zinc-500">{entries.length} entradas</span>
          {errors > 0   && <span className="text-red-400 font-semibold">{errors} erros</span>}
          {warnings > 0 && <span className="text-yellow-400 font-semibold">{warnings} avisos</span>}
        </div>
        <button
          onClick={clear}
          className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Limpar
        </button>
      </div>

      {/* Lista de logs */}
      <div className="flex-1 overflow-y-auto bg-zinc-950 divide-y divide-zinc-900">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-700">
            <span className="text-[11px]">Sem logs ainda — interage com a app.</span>
          </div>
        ) : (
          entries.map(entry => <LogRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
