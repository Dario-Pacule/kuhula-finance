"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Sprout, 
  Settings, 
  Smartphone, 
  Landmark, 
  Wallet, 
  Target, 
  ListOrdered, 
  Bot, 
  Send, 
  Eye, 
  EyeOff, 
  Download, 
  Upload, 
  Trash2, 
  Info,
  ChevronRight,
  Terminal,
  Copy,
  Check,
  Plus,
  Search,
  Filter,
  CalendarDays,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  LogOut,
  Cloud,
  CloudOff,
  Loader2
} from "lucide-react";

import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { AppState, Goal, ChatMessage, AskUserInputArgs } from "@/types";
import { log } from "@/lib/logger";
import { initChatLogQueue, pushChatEvent, flushNow, getChatSessionId } from "@/lib/ChatLogQueue";
import { ChatInteractiveInput } from "@/components/ChatInteractiveInput";
import { RichChatInput } from "@/components/RichChatInput";
import { RuntimeLogsPanel } from "@/components/RuntimeLogsPanel";
import { usePersistence, type PersistAction, type SyncStatus } from "@/hooks/usePersistence";
import { AI_PROVIDERS, getDefaultModel, sanitizeModelId, type ProviderId, type ModelOption } from "@/lib/ai-providers";

const DEFAULT_STATE: AppState = {
  accounts: {},
  transactions: [],
  goals: [],
  budgetLimits: {},
  strategies: []
};

/** Ferramentas que alteram dados financeiros — requerem confirmação visual do utilizador */
const FINANCIAL_TOOLS = new Set([
  "addTransaction",
  "deleteTransaction",
  "adjustAccountBalance",
  "deleteAccount",
  "createOrUpdateGoal",
  "deleteGoal",
  "setBudgetLimit",
  "createOrUpdateStrategy",
  "deleteStrategy",
]);

const SUGGESTIONS = [
  "Tenho 50.000 MT na conta do BCI e 8.000 MT no M-Pesa",
  "Recebi o meu salário de 45.000 MT na conta bancária",
  "Paguei 1.200 MT de energia Credelec com M-Pesa",
  "Ajuda-me a planear o seguro do carro que custa 18.000 MT em Dezembro"
];

export default function Home() {
  // Estado Financeiro
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  
  // Estados de Sincronização e Carregamento
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [isChatHistoryLoading, setIsChatHistoryLoading] = useState<boolean>(true);
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Confirmação pendente de operação financeira (interceptada antes da execução)
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    toolCalls: Array<{ name: string; args: any }>;
    history: ChatMessage[];
    appState: AppState;
  } | null>(null);
  
  // Estado IA — multi-provider
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [model, setModel] = useState<string>("gemini-1.5-flash-latest");
  const [clientApiKey, setClientApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  // Inputs temporários do modal de configurações
  const [inputProvider, setInputProvider] = useState<ProviderId>("gemini");
  const [inputModel, setInputModel] = useState<string>("gemini-1.5-flash-latest");
  const [inputApiKey, setInputApiKey] = useState<string>("");
  const [submitOnEnter, setSubmitOnEnter] = useState<boolean>(true);
  const [inputSubmitOnEnter, setInputSubmitOnEnter] = useState<boolean>(true);

  // Modelos dinâmicos
  const [dynamicModels, setDynamicModels] = useState<Record<ProviderId, ModelOption[]>>({} as any);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  
  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(false);

  // Memória de sessão: regista o que foi mencionado na conversa mas ainda não registado no painel
  const sessionMemoryRef = useRef<{
    mentionedIncomes: Array<{ amount: number; source: string; account?: string }>;
    mentionedExpenses: Array<{ amount: number; description: string; account?: string }>;
    contextNotes: string[];
  }>({
    mentionedIncomes: [],
    mentionedExpenses: [],
    contextNotes: [],
  });
  
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "metrics">(() => {
    if (typeof window === "undefined") return "dashboard";
    const saved = localStorage.getItem("kuhula_active_tab");
    return (saved === "chat" || saved === "metrics" || saved === "dashboard") ? saved : "dashboard";
  });

  // Guarda a tab activa sempre que muda
  const handleSetActiveTab = (tab: "dashboard" | "chat" | "metrics") => {
    setActiveTab(tab);
    localStorage.setItem("kuhula_active_tab", tab);
  };
  const [tokenStats, setTokenStats] = useState({
    totalRequests: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  });
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Depuração de Layout
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [errorLogs, setErrorLogs] = useState<Array<{ timestamp: string; provider: string; model: string; message: string }>>([]);
  const [isDebugView, setIsDebugView] = useState<"layout" | "errors" | "health" | "runtime">("layout");
  const [healthCheck, setHealthCheck] = useState<Array<{
    label: string;
    status: "ok" | "error" | "warning" | "loading";
    detail: string;
  }>>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Gestão Manual de Contas
  const [isAddAccountOpen, setIsAddAccountOpen] = useState<boolean>(false);
  const [newAccountName, setNewAccountName] = useState<string>("");
  const [newAccountBalance, setNewAccountBalance] = useState<string>("");

  // Filtros de Transações
  const [txFilterType, setTxFilterType] = useState<"all" | "income" | "expense" | "recurring">("all");
  const [txFilterCategory, setTxFilterCategory] = useState<string>("all");
  const [txFilterAccount, setTxFilterAccount] = useState<string>("all");
  const [txSearchQuery, setTxSearchQuery] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [chartView, setChartView] = useState<"projection" | "history">("projection");
  
  // Referências
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Diálogos
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Hook de persistência (Supabase + localStorage fallback)
  const { persistAction, persistChatMessages, saveAiConfig, clearRemoteData } = usePersistence({
    onStateLoaded: (loadedState) => setState(loadedState),
    onChatHistoryLoaded: (records) => {
      const chatMessages = records.map(r => ({
        role: r.role as "user" | "model",
        parts: [{ text: r.content }],
      }));
      setMessages(chatMessages);
    },
    onAiConfigLoaded: (config) => {
      const sanitizedModel = sanitizeModelId(config.model);
      setProvider(config.provider as ProviderId);
      setModel(sanitizedModel);
      setClientApiKey(config.apiKey);
      setInputProvider(config.provider as ProviderId);
      setInputModel(sanitizedModel);
      setInputApiKey(config.apiKey);
      if (config.submitOnEnter !== undefined) {
        setSubmitOnEnter(config.submitOnEnter);
        setInputSubmitOnEnter(config.submitOnEnter);
      }
    },
    onSyncStatusChange: (status) => setSyncStatus(status),
    onChatHistoryLoadComplete: () => setIsChatHistoryLoading(false),
  });

  // Inicializar ChatLogQueue quando userId estiver disponível
  useEffect(() => {
    if (!userId.current) return;
    initChatLogQueue(userId.current, provider, model);

    // Flush ao fechar a página
    const handleUnload = () => { flushNow(); };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId.current]);

  // Inicialização (Client-side)
  useEffect(() => {
    // Config de IA, estado financeiro e histórico de chat
    // são carregados pelo usePersistence hook automaticamente.

    const savedSubmit = localStorage.getItem("kuhula_submit_on_enter");
    const parsedSubmit = savedSubmit !== null ? savedSubmit === "true" : true;
    setSubmitOnEnter(parsedSubmit);
    setInputSubmitOnEnter(parsedSubmit);


    // Estatísticas de tokens
    const savedTokenStats = localStorage.getItem("kuhula_token_stats");
    if (savedTokenStats) {
      try { setTokenStats(JSON.parse(savedTokenStats)); } catch {}
    }

    // Responsividade móvel
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    
    setIsMounted(true);
    
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Rolar para baixo ao receber novas mensagens ou quando o chat for aberto
  useEffect(() => {
    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    };

    if (!isChatCollapsed || activeTab === "chat") {
      // Rola imediatamente de forma instantânea
      scrollToBottom("auto");
      
      // Executa após breves momentos para garantir o ajuste após transição de layout
      const timer1 = setTimeout(() => scrollToBottom("auto"), 50);
      const timer2 = setTimeout(() => scrollToBottom("smooth"), 300);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [messages, isTyping, isChatCollapsed, activeTab]);

  // Scroll para a última mensagem quando o histórico termina de carregar
  useEffect(() => {
    if (!isChatHistoryLoading && messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      }, 100);
    }
  }, [isChatHistoryLoading]);

  // Persistir Estado Financeiro — actualiza React state + localStorage
  // A persistência na DB é feita atomicamente por executeToolAction via persistAction
  const saveState = (newState: AppState) => {
    setState(newState);
    localStorage.setItem("kuhula_state_v2", JSON.stringify(newState));
  };

  // Persistir Histórico de Chat
  // Nota: NÃO chama setMessages — o estado React é gerido pelos chamadores via setMessages(prev=>[...prev, msg])
  // Isto evita o bug de stale closure onde o histórico substitui mensagens recentes não reflectidas no closure
  const saveChatHistory = (historyForLocalStorage: ChatMessage[], newMessages?: Array<{ role: "user" | "model"; content: string }>) => {
    localStorage.setItem("kuhula_chat_history", JSON.stringify(historyForLocalStorage));
    // Guarda apenas as mensagens novas deste turno na DB (evita duplicados)
    if (newMessages?.length) persistChatMessages(newMessages);
  };

  // Atualizar Estatísticas de Tokens
  const updateTokenStats = (prompt: number, completion: number) => {
    setTokenStats(prev => {
      const newStats = {
        totalRequests: prev.totalRequests + 1,
        promptTokens: prev.promptTokens + prompt,
        completionTokens: prev.completionTokens + completion,
        totalTokens: prev.totalTokens + prompt + completion
      };
      localStorage.setItem("kuhula_token_stats", JSON.stringify(newStats));
      return newStats;
    });
  };

  // Formatação de Moeda
  const formatCurrency = (value: number) => {
    const formatted = new Intl.NumberFormat("pt-MZ", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
    return `${formatted} MT`;
  };

  // Formatação de Data
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // Calcular Saldos
  const walletsList = ["m-pesa", "e-mola", "mkesh", "carteira móvel", "carteira movel", "carteira"];
  let totalBanks = 0;
  let totalWallets = 0;

  for (const [accName, balance] of Object.entries(state.accounts)) {
    if (walletsList.includes(accName.toLowerCase())) {
      totalWallets += balance;
    } else {
      totalBanks += balance;
    }
  }
  const totalConsolidated = totalBanks + totalWallets;

  // Obter lista de meses com transações (e garantir o mês atual)
  const getMonthsList = () => {
    const months = new Set<string>();
    const currentYearMonth = new Date().toISOString().substring(0, 7); // "YYYY-MM"
    months.add(currentYearMonth);

    state.transactions.forEach(tx => {
      if (tx.date) {
        months.add(tx.date.substring(0, 7)); // "YYYY-MM"
      }
    });

    return Array.from(months).sort().reverse();
  };

  // Formatar nome do mês em Português
  const formatMonthName = (yearMonth: string) => {
    if (yearMonth === "all") return "Todos os Períodos";
    const [year, month] = yearMonth.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleString("pt-MZ", { month: "long" });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
  };

  // Calcular métricas para o período selecionado
  const getMonthlyMetrics = () => {
    let income = 0;
    let expenses = 0;

    state.transactions.forEach(tx => {
      if (selectedMonth === "all" || tx.date.substring(0, 7) === selectedMonth) {
        if (tx.type === "income") {
          income += tx.amount;
        } else {
          expenses += tx.amount;
        }
      }
    });

    return {
      monthlyIncome: income,
      monthlyExpenses: expenses,
      monthlyNet: income - expenses
    };
  };

  const { monthlyIncome, monthlyExpenses, monthlyNet } = getMonthlyMetrics();

  // Gerar dados históricos para o gráfico de barras mensal (últimos 6 meses)
  const getHistoricalMonthlyData = () => {
    const data = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const yearMonth = d.toISOString().substring(0, 7); // "YYYY-MM"
      
      let income = 0;
      let expenses = 0;
      
      state.transactions.forEach(tx => {
        if (tx.date.substring(0, 7) === yearMonth) {
          if (tx.type === "income") {
            income += tx.amount;
          } else {
            expenses += tx.amount;
          }
        }
      });
      
      const label = d.toLocaleString("pt-MZ", { month: "short", year: "2-digit" });
      data.push({
        name: label.charAt(0).toUpperCase() + label.slice(1),
        "Receitas": Math.round(income),
        "Despesas": Math.round(expenses)
      });
    }
    
    return data;
  };

  // Obter crachá visual para a frequência da estratégia
  const getFrequencyBadge = (freq?: string) => {
    if (!freq) return null;
    
    let label = "Pontual";
    let colorClass = "bg-zinc-800/40 text-zinc-400 border border-zinc-700/60";
    
    if (freq === "daily") {
      label = "Diário";
      colorClass = "bg-blue-950/30 text-blue-400 border border-blue-900/40";
    } else if (freq === "weekly") {
      label = "Semanal";
      colorClass = "bg-purple-950/30 text-purple-400 border border-purple-900/40";
    } else if (freq === "monthly") {
      label = "Mensal";
      colorClass = "bg-emerald-950/30 text-emerald-400 border border-emerald-900/40";
    }
    
    return (
      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${colorClass}`}>
        {label}
      </span>
    );
  };

  // Gerar dados de projeção para o gráfico Recharts (180 dias)
  const getProjectionData = () => {
    const data = [];
    const today = new Date();
    let currentBalance = totalConsolidated;

    for (let day = 0; day <= 180; day++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() + day);
      const dayOfMonth = currentDate.getDate();

      // Processar recorrencia
      state.transactions.forEach(tx => {
        if (tx.isRecurring && tx.dayOfMonth === dayOfMonth) {
          if (tx.type === "income") {
            currentBalance += tx.amount;
          } else {
            currentBalance -= tx.amount;
          }
        }
      });

      // Guardar a cada 10 dias para limpar o gráfico
      if (day % 10 === 0) {
        const formattedLabel = `${currentDate.getDate()} ${currentDate.toLocaleString("pt-MZ", { month: "short" })}`;
        data.push({
          name: formattedLabel,
          "Saldo Projetado": Math.round(currentBalance)
        });
      }
    }
    return data;
  };

  // Funções de Depuração de Layout
  const getRectStr = (id: string) => {
    if (typeof window === "undefined") return "N/A";
    const el = document.getElementById(id);
    if (!el) return "Não encontrado na DOM";
    const r = el.getBoundingClientRect();
    return `largura=${r.width.toFixed(1)}px, altura=${r.height.toFixed(1)}px, topo=${r.top.toFixed(1)}px, esquerda=${r.left.toFixed(1)}px`;
  };

  const handleOpenDebug = () => {
    if (typeof window === "undefined") return;
    
    const rootRect = getRectStr("main-layout-root");
    const headerRect = getRectStr("main-header");
    const dashRect = getRectStr("dashboard-container");
    const chatRect = getRectStr("chat-container");
    
    const info = `### Kuhula Finance - Diagnóstico de Layout
- **Data/Hora**: ${new Date().toISOString()}
- **User Agent**: ${navigator.userAgent}
- **Dispositivo Móvel Detectado (isMobile)**: ${isMobile ? "Sim" : "Não"}
- **Aba Ativa**: ${activeTab}
- **Chat Minimizado**: ${isChatCollapsed ? "Sim" : "Não"}

#### Viewport & Ecrã
- **Janela (innerWidth/Height)**: ${window.innerWidth}x${window.innerHeight} px
- **Documento (clientWidth/Height)**: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight} px
- **Ecrã Total (screen.width/height)**: ${window.screen?.width || 0}x${window.screen?.height || 0} px
- **Ecrã Disponível (screen.availWidth/height)**: ${window.screen?.availWidth || 0}x${window.screen?.availHeight || 0} px
- **Visual Viewport**: ${window.visualViewport ? `${window.visualViewport.width.toFixed(1)}x${window.visualViewport.height.toFixed(1)} px (escala: ${window.visualViewport.scale})` : "N/A"}
- **Device Pixel Ratio**: ${window.devicePixelRatio}
- **Orientação**: ${window.innerHeight > window.innerWidth ? "Vertical (Portrait)" : "Horizontal (Landscape)"}
- **Suporte Touch**: ${'ontouchstart' in window ? "Sim" : "Não"} (maxTouchPoints: ${navigator.maxTouchPoints || 0})

#### Retângulos dos Elementos (DOM)
- **Root (#main-layout-root)**: ${rootRect}
- **Header (#main-header)**: ${headerRect}
- **Dashboard (#dashboard-container)**: ${dashRect}
- **Chat (#chat-container)**: ${chatRect}
`;
    setDebugInfo(info);
    setIsCopied(false);
    setIsDebugOpen(true);
  };

  const runHealthCheck = async () => {
    setIsDebugView("health");
    const loading = [
      { label: "API de IA (/api/chat)", status: "loading" as const, detail: "A verificar..." },
      { label: "Base de Dados (/api/state)", status: "loading" as const, detail: "A verificar..." },
      { label: "Chave de API configurada", status: "loading" as const, detail: "A verificar..." },
      { label: "Histórico de Chat (/api/chat-history)", status: "loading" as const, detail: "A verificar..." },
      { label: "Ligação à Internet", status: "loading" as const, detail: "A verificar..." },
    ];
    setHealthCheck(loading);

    const results: Array<{ label: string; status: "ok" | "error" | "warning" | "loading"; detail: string }> = [...loading];

    // 1. Ligação à internet
    try {
      const start = Date.now();
      await fetch("https://www.google.com/favicon.ico", { mode: "no-cors", cache: "no-store" });
      results[4] = { label: "Ligação à Internet", status: "ok", detail: `Online (${Date.now() - start}ms)` };
    } catch {
      results[4] = { label: "Ligação à Internet", status: "error", detail: "Sem ligação à internet" };
    }
    setHealthCheck([...results]);

    // 2. Chave de API configurada
    if (!clientApiKey) {
      results[2] = { label: "Chave de API configurada", status: "error", detail: `Nenhuma chave configurada para ${provider}` };
    } else {
      results[2] = { label: "Chave de API configurada", status: "ok", detail: `${provider} — chave presente (${clientApiKey.slice(0, 8)}...)` };
    }
    setHealthCheck([...results]);

    // 3. API de IA
    try {
      const start = Date.now();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [{ role: "user", content: "olá" }],
          systemInstruction: "Responde apenas com: ok",
          provider,
          model,
          clientApiKey,
        }),
      });
      const data = await res.json();
      const ms = Date.now() - start;
      if (!res.ok || data.error) {
        results[0] = { label: "API de IA (/api/chat)", status: "error", detail: data.error ?? `HTTP ${res.status}` };
      } else {
        results[0] = { label: "API de IA (/api/chat)", status: "ok", detail: `${provider}/${model} — ${ms}ms` };
      }
    } catch (e: any) {
      results[0] = { label: "API de IA (/api/chat)", status: "error", detail: e.message ?? "Erro desconhecido" };
    }
    setHealthCheck([...results]);

    // 4. Base de dados
    try {
      const start = Date.now();
      const res = await fetch("/api/state?userId=health-check-ping");
      const ms = Date.now() - start;
      if (res.ok) {
        results[1] = { label: "Base de Dados (/api/state)", status: "ok", detail: `Supabase acessível (${ms}ms)` };
      } else {
        results[1] = { label: "Base de Dados (/api/state)", status: "warning", detail: `HTTP ${res.status} — pode ser problema de configuração` };
      }
    } catch (e: any) {
      results[1] = { label: "Base de Dados (/api/state)", status: "error", detail: e.message ?? "Sem resposta" };
    }
    setHealthCheck([...results]);

    // 5. Histórico de chat
    try {
      const start = Date.now();
      const res = await fetch("/api/chat-history?userId=health-check-ping");
      const ms = Date.now() - start;
      if (res.ok) {
        results[3] = { label: "Histórico de Chat (/api/chat-history)", status: "ok", detail: `Acessível (${ms}ms)` };
      } else {
        results[3] = { label: "Histórico de Chat (/api/chat-history)", status: "warning", detail: `HTTP ${res.status}` };
      }
    } catch (e: any) {
      results[3] = { label: "Histórico de Chat (/api/chat-history)", status: "error", detail: e.message ?? "Sem resposta" };
    }
    setHealthCheck([...results]);
  };

  const handleCopyDebug = () => {
    if (typeof navigator === "undefined") return;
    
    const textToCopy = isDebugView === "errors"
      ? errorLogs.map(log => `[${log.timestamp}] Provider: ${log.provider} - Modelo: ${log.model || "N/A"}\n${log.message}`).join("\n\n")
      : debugInfo;
      
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Falha ao copiar com navigator.clipboard, usando fallback", err);
          fallbackCopyText(textToCopy);
        });
    } else {
      fallbackCopyText(textToCopy);
    }
  };

  const handleFetchModels = async () => {
    if (!inputApiKey && inputProvider !== "openrouter") return;
    setIsFetchingModels(true);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: inputProvider, apiKey: inputApiKey })
      });
      const data = await res.json();
      if (res.ok && data.models?.length > 0) {
        setDynamicModels(prev => ({ ...prev, [inputProvider]: data.models }));
        setInputModel(data.models[0].id);
        const modelNames = data.models.map((m: any) => m.id).join(", ");
        addSystemLog(`Modelos carregados (${inputProvider}): ${modelNames}`);
        log.info("ai-config", `Modelos carregados (${inputProvider})`, data.models.map((m: any) => m.id));
      } else {
        console.error("Falha ao carregar modelos", data.error);
        addSystemLog(`Falha ao carregar modelos dinâmicos: ${data.error || "Erro desconhecido"}`);
        log.error("ai-config", "Falha ao carregar modelos dinâmicos", data.error);
      }
    } catch (e: any) {
      console.error(e);
      addSystemLog(`Erro ao carregar modelos: ${e.message}`);
      log.error("ai-config", "Exceção em handleFetchModels", e.message);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        alert("Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.");
      }
    } catch (err) {
      console.error("Erro no fallback de cópia", err);
      alert("Não foi possível copiar automaticamente.");
    }
  };

  // Funções de Gestão Manual de Contas
  const handleCreateAccount = () => {
    const trimmedName = newAccountName.trim();
    if (!trimmedName) {
      alert("Por favor, introduza o nome da conta.");
      return;
    }
    const balance = parseFloat(newAccountBalance) || 0;
    
    const updatedAccounts = {
      ...state.accounts,
      [trimmedName]: balance
    };
    
    saveState({
      ...state,
      accounts: updatedAccounts
    });
    
    addSystemLog(`Conta "${trimmedName}" adicionada manualmente com saldo de ${formatCurrency(balance)}.`);
    
    setNewAccountName("");
    setNewAccountBalance("");
    setIsAddAccountOpen(false);
  };

  const handleDeleteAccount = (accountName: string) => {
    if (confirm(`Deseja realmente remover a conta "${accountName}"?`)) {
      const updatedAccounts = { ...state.accounts };
      delete updatedAccounts[accountName];
      
      saveState({
        ...state,
        accounts: updatedAccounts
      });
      
      addSystemLog(`Conta "${accountName}" removida manualmente.`);
    }
  };

  // Funções de Filtragem do Histórico Financeiro
  const getFilteredTransactions = () => {
    return [...state.transactions]
      .filter((tx) => {
        // Filtrar por Mês Selecionado (caso não seja "all")
        if (selectedMonth !== "all") {
          const txYearMonth = tx.date.substring(0, 7);
          if (txYearMonth !== selectedMonth) return false;
        }

        if (txFilterType === "income" && tx.type !== "income") return false;
        if (txFilterType === "expense" && tx.type !== "expense") return false;
        if (txFilterType === "recurring" && !tx.isRecurring) return false;
        
        if (txFilterCategory !== "all" && tx.category.toLowerCase() !== txFilterCategory.toLowerCase()) return false;
        if (txFilterAccount !== "all" && tx.account.toLowerCase() !== txFilterAccount.toLowerCase()) return false;
        
        if (txSearchQuery.trim()) {
          const query = txSearchQuery.toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(query);
          const matchAccount = tx.account.toLowerCase().includes(query);
          const matchCat = tx.category.toLowerCase().includes(query);
          if (!matchDesc && !matchAccount && !matchCat) return false;
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const uniqueCategories = Array.from(new Set(state.transactions.map(t => t.category.trim())));

  const uniqueAccounts = Array.from(new Set([
    ...Object.keys(state.accounts),
    ...state.transactions.map(t => t.account.trim())
  ]));

  // Configurações de IA — multi-provider
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      setProvider(inputProvider);
      setModel(inputModel);
      setClientApiKey(inputApiKey);
      setSubmitOnEnter(inputSubmitOnEnter);

      // Guarda na DB (sincroniza entre dispositivos)
      await saveAiConfig({
        provider: inputProvider,
        model: inputModel,
        apiKey: inputApiKey,
        submitOnEnter: inputSubmitOnEnter,
      });

      log.info("ai-config", `Configurações guardadas`, { provider: inputProvider, model: inputModel, hasKey: !!inputApiKey });

      setIsSettingsOpen(false);
      addSystemLog(`Configurações actualizadas — Provider: ${inputProvider}, Modelo: ${inputModel}`);
    } catch (e: any) {
      log.error("ai-config", "Erro ao guardar configurações", e?.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Quando o provider muda no modal, actualiza o modelo e a chave para os defaults desse provider
  const handleProviderChange = (newProvider: ProviderId) => {
    setInputProvider(newProvider);
    setInputModel(getDefaultModel(newProvider));
    setInputApiKey(localStorage.getItem(`kuhula_key_${newProvider}`) || "");
  };

  // Limpar Todos os Dados
  const handleClearAllData = () => {
    if (confirm("ATENÇÃO: Isto apagará todas as transacções, contas e metas permanentemente. Deseja prosseguir?")) {
      const reset = { accounts: {}, transactions: [], goals: [], budgetLimits: {} };
      saveState(reset);
      saveChatHistory([]);
      clearRemoteData();
      setIsSettingsOpen(false);
      addSystemLog("Todos os dados foram apagados.");
    }
  };

  // Exportar Backup
  const handleExportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `kuhula_finance_next_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Importar Backup
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function() {
      try {
        const result = reader.result;
        if (typeof result === "string") {
          const parsed = JSON.parse(result);
          if (parsed.accounts && parsed.transactions && parsed.goals) {
            saveState(parsed);
            addSystemLog("Dados importados com sucesso!");
            setIsSettingsOpen(false);
          } else {
            alert("O arquivo JSON não é um backup válido.");
          }
        }
      } catch {
        alert("Erro ao ler o arquivo.");
      }
    };
    reader.readAsText(file);
  };

  // Quando o utilizador responde a um input interactivo da IA
  const handleInteractiveAnswer = (msgIndex: number, answer: string) => {
    setMessages(prev => prev.map((m, i) =>
      i === msgIndex && m.role === "interactive"
        ? { ...m, interactiveInput: { ...m.interactiveInput!, answered: true, answeredValue: answer } }
        : m
    ));

    // Log: resposta ao askUserInput
    const msg = messages[msgIndex];
    if (!msg?.isPendingFinancial) {
      pushChatEvent({
        eventType: "tool_answered",
        toolName: "askUserInput",
        content: answer,
        provider,
        model,
      });
    }

    if (msg?.isPendingFinancial) {
      handleFinancialConfirmation(answer === "Sim");
    } else {
      handleSendMessage(answer);
    }
  };


  const renderSyncStatus = () => {
    switch (syncStatus) {
      case "syncing":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-md text-[10px] text-zinc-400 select-none" title="A sincronizar com a base de dados...">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
            <span className="hidden sm:inline">A sincronizar...</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/20 border border-red-900/50 rounded-md text-[10px] text-rose-400 select-none" title="Erro na sincronização com o Supabase">
            <CloudOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Erro de ligação</span>
          </div>
        );
      case "synced":
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900/40 border border-zinc-800/40 rounded-md text-[10px] text-emerald-500 select-none" title="Todos os dados sincronizados na nuvem">
            <Cloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sincronizado</span>
          </div>
        );
    }
  };

  const addSystemLog = (text: string) => {
    const sysMsg: ChatMessage = {
      role: "system",
      parts: [{ text }]
    };
    setMessages(prev => [...prev, sysMsg]);
  };

  // Excluir transação manualmente
  const handleDeleteTransactionLocal = (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta transação?")) {
      const tx = state.transactions.find(t => t.id === id);
      if (tx) {
        const updatedAccounts = { ...state.accounts };
        if (updatedAccounts[tx.account] !== undefined) {
          if (tx.type === "income") {
            updatedAccounts[tx.account] -= tx.amount;
          } else {
            updatedAccounts[tx.account] += tx.amount;
          }
        }
        const updatedTxs = state.transactions.filter(t => t.id !== id);
        saveState({
          ...state,
          accounts: updatedAccounts,
          transactions: updatedTxs
        });
        addSystemLog(`Transação "${tx.description}" excluída manualmente.`);
      }
    }
  };

  // Enviar Mensagem para o Gemini
  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    log.info("chat", "Mensagem enviada", { text: text.substring(0, 100) + (text.length > 100 ? "..." : "") });

    // Log: mensagem do utilizador
    pushChatEvent({
      eventType: "user_message",
      content: text,
      provider,
      model,
    });

    const newHistory: ChatMessage[] = [
      ...messages,
      { role: "user", parts: [{ text }], timestamp: new Date().toISOString() }
    ];

    setMessages(prev => [
      ...prev,
      { role: "user", parts: [{ text }], timestamp: new Date().toISOString() }
    ]);
    
    setInputValue("");

    if (!clientApiKey) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: "model", parts: [{ text: `Por favor, configure a chave de API para **${provider}** nas definições ⚙️.` }], timestamp: new Date().toISOString() }
        ]);
      }, 600);
      return;
    }

    setIsTyping(true);
    const requestStart = Date.now();

    try {
      const response = await callChatAPI(newHistory, state);
      const latencyMs = Date.now() - requestStart;
      setIsTyping(false);

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Capturar estatísticas de tokens da primeira chamada
      if (response.usageMetadata) {
        updateTokenStats(
          response.usageMetadata.promptTokenCount || 0,
          response.usageMetadata.candidatesTokenCount || 0
        );
      }

      // Log: resposta da IA
      pushChatEvent({
        eventType: "ai_response",
        content: response.text ?? "",
        latencyMs,
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
        provider,
        model,
      });

      // Log: tool calls feitas
      for (const tc of (response.toolCallsMade ?? [])) {
        pushChatEvent({
          eventType: "tool_call",
          toolName: tc.name,
          toolArgs: tc.args,
          toolResult: tc.result,
          provider,
          model,
        });
      }

      // Log: askUserInput
      if (response.askUserInput) {
        pushChatEvent({
          eventType: "tool_input",
          toolName: "askUserInput",
          toolArgs: response.askUserInput,
          provider,
          model,
        });
      }

      await handleAIResponse(response, newHistory, state);
    } catch (err: any) {
      setIsTyping(false);
      const errorDetail = err.message || String(err);
      const timestamp = new Date().toLocaleTimeString("pt-MZ");

      // Adiciona ao log de erros estruturado
      setErrorLogs(prev => [...prev, {
        timestamp,
        provider,
        model,
        message: errorDetail,
      }]);
      setIsDebugView("errors");

      // Mensagem amigável para rate limit 429
      const is429 = errorDetail.includes("429") || errorDetail.toLowerCase().includes("rate limit") || errorDetail.toLowerCase().includes("quota");
      const friendlyMessage = is429
        ? `⚡ **Limite de pedidos atingido** no provider **${provider}**.\n\nO plano gratuito tem um limite de pedidos por minuto. Aguarda alguns segundos e tenta novamente, ou muda de provider nas configurações ⚙️.`
        : `Ocorreu um erro ao contactar o provider **${provider}**:\n\`${errorDetail}\`\n\nVerifica as configurações ⚙️ — chave de API e modelo seleccionado.`;

      // Log: erro de IA
      pushChatEvent({
        eventType: "ai_error",
        errorCode: is429 ? "429" : "unknown",
        errorMessage: errorDetail,
        latencyMs: Date.now() - requestStart,
        provider,
        model,
      });

      // Mostra erro no chat com opção de reenvio
      setMessages(prev => [
        ...prev,
        {
          role: "model" as const,
          parts: [{ text: friendlyMessage }],
          isError: true,
          retryText: text,
          timestamp: new Date().toISOString(),
        }
      ]);
    }
  };

  // Chamar Rota de API
  const callChatAPI = async (history: ChatMessage[], currentState: AppState) => {
    // ── Restaurar memória de sessão do localStorage se ainda não foi feita esta sessão ──
    if (typeof window !== "undefined" && !sessionMemoryRef.current.mentionedIncomes.length &&
        !sessionMemoryRef.current.mentionedExpenses.length) {
      const savedMem = localStorage.getItem("kuhula_session_memory");
      if (savedMem) {
        try {
          const parsed = JSON.parse(savedMem);
          sessionMemoryRef.current = {
            mentionedIncomes: parsed.mentionedIncomes ?? [],
            mentionedExpenses: parsed.mentionedExpenses ?? [],
            contextNotes: parsed.contextNotes ?? [],
          };
        } catch { /* ignora erros de parse */ }
      }
    }

    // ── Saldos por conta ──
    const totalBalance = Object.values(currentState.accounts).reduce((a, b) => a + b, 0);

    // ── Mês actual e últimos 3 meses ──
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);

    // Agrega despesas por categoria (mês actual)
    const expensesByCategory: Record<string, number> = {};
    const incomeBySource: Record<string, number> = {};
    currentState.transactions.forEach(t => {
      if (!t.date.startsWith(currentMonth)) return;
      if (t.type === "expense") {
        expensesByCategory[t.category] = (expensesByCategory[t.category] ?? 0) + t.amount;
      } else {
        incomeBySource[t.category] = (incomeBySource[t.category] ?? 0) + t.amount;
      }
    });

    // Tendência dos últimos 3 meses
    const trends = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = d.toISOString().substring(0, 7);
      let income = 0, expenses = 0;
      currentState.transactions.forEach(t => {
        if (!t.date.startsWith(ym)) return;
        if (t.type === "income") income += t.amount;
        else expenses += t.amount;
      });
      return { month: ym, income, expenses, net: income - expenses };
    });

    // Utilização do orçamento (% gasto vs limite)
    const budgetUtilization = Object.entries(currentState.budgetLimits).map(([cat, limit]) => {
      const spent = currentState.transactions
        .filter(t => t.type === "expense" && t.category.toLowerCase() === cat.toLowerCase() && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);
      return `${cat}: ${spent.toLocaleString("pt-MZ")}/${limit.toLocaleString("pt-MZ")} MT (${Math.round((spent / limit) * 100)}%)`;
    });

    // Compromissos recorrentes
    const recurringMonthly = currentState.transactions
      .filter(t => t.isRecurring && t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const recurringIncome = currentState.transactions
      .filter(t => t.isRecurring && t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    // Últimas 15 transacções para referência rápida
    const recentTxs = currentState.transactions.slice(-15).map(t => ({
      id: t.id, desc: t.description, amt: t.amount, type: t.type,
      cat: t.category, acc: t.account, date: t.date, rec: t.isRecurring
    }));

    // ── Resumo de memória de sessão ──
    const mem = sessionMemoryRef.current;
    const sessionSummary = [
      mem.mentionedIncomes.length > 0
        ? `Rendimentos mencionados na conversa (podem não estar todos registados): ${mem.mentionedIncomes.map(i => `${i.amount} MT de ${i.source}${i.account ? ` na conta ${i.account}` : ""}`).join("; ")}`
        : null,
      mem.mentionedExpenses.length > 0
        ? `Despesas mencionadas na conversa (podem não estar todas registadas): ${mem.mentionedExpenses.map(e => `${e.amount} MT de ${e.description}${e.account ? ` via ${e.account}` : ""}`).join("; ")}`
        : null,
      ...mem.contextNotes
    ].filter(Boolean).join("\n");

    // ── Perfil do utilizador ──
    const profile = currentState.userProfile;
    const profileSection = profile && Object.keys(profile).length > 1 ? `\n## PERFIL DO UTILIZADOR (aprendido em conversas anteriores)\n${[
      profile.name ? `- Nome: ${profile.name}` : null,
      profile.occupation ? `- Profissão: ${profile.occupation}` : null,
      profile.monthlyIncome ? `- Rendimento mensal típico: ${profile.monthlyIncome.toLocaleString("pt-MZ")} MT` : null,
      profile.incomeDay ? `- Recebe o salário por volta do dia ${profile.incomeDay} do mês` : null,
      profile.familySize ? `- Dependentes: ${profile.familySize} pessoa(s)` : null,
      profile.primaryAccounts?.length ? `- Contas principais: ${profile.primaryAccounts.join(", ")}` : null,
      profile.financialGoalNarrative ? `- Objectivos: ${profile.financialGoalNarrative}` : null,
      profile.behaviorNotes ? `- Comportamento observado: ${profile.behaviorNotes}` : null,
    ].filter(Boolean).join("\n")}` : "";

    const systemInstruction = `És o Kuhula — um conselheiro financeiro pessoal de Moçambique. A tua missão principal não é registar dados: é **compreender profundamente a vida e o comportamento financeiro do utilizador** para o ajudar a tomar melhores decisões.

## FILOSOFIA CENTRAL

Antes de qualquer ferramenta, número ou conselho, pergunta-te:
- O que é que esta pessoa realmente precisa neste momento?
- Qual é o padrão de comportamento financeiro que vejo aqui?
- O que está a bloquear o progresso financeiro desta pessoa?
- Que emoção ou crença está por trás deste comportamento?

O dinheiro é sempre um reflexo de comportamentos, hábitos e crenças. O teu trabalho é ajudar o utilizador a ver isso com clareza — sem julgamento, com empatia.

## COMO CONVERSAS

**Seja EXTREMAMENTE objectivo e directo.** O utilizador não tem tempo para ler introduções longas. Não escrevas textos como "Ótimo! Fico feliz que...", "Para te poder ajudar...", etc. Vai directo ao assunto.
Se tiveres que fazer uma pergunta, faz APENAS UMA pergunta curta. Não faças listas de perguntas.

**Usa inputs interactivos** (askUserInput) APENAS quando há opções predefinidas claras e limitadas. Exemplos correctos:
- "Qual conta usaste?" → single: M-Pesa|BCI|e-Mola
- "Que categorias incluir?" → multiple com lista fixa
- "Quanto poupar por mês?" → slider com intervalo conhecido

**NUNCA uses askUserInput para perguntas abertas** como "O que aconteceu?", "Qual é o detalhe?", "Conta-me mais." — essas ficam como texto normal. Se não tens opções predefinidas, escreve a pergunta normalmente. **Nunca uses askUserInput com inputType="confirm" para operações financeiras** — o sistema mostra automaticamente um cartão de confirmação ao utilizador antes de executar qualquer operação.
Sempre que precisares que o utilizador escolha uma opção predefinida, és OBRIGADO a usar a ferramenta **askUserInput** (não uses texto normal com listas enumeradas).

**Recolhe a informação necessária antes de chamar ferramentas financeiras.** Certifica-te de que tens: valor, tipo (receita/despesa), categoria, conta. Se falta algum dado essencial, pergunta primeiro. Quando tiveres tudo, chama a ferramenta directamente.

**Aprende e lembra.** Quando o utilizador revelar factos sobre si (nome, profissão, salário, hábitos, objectivos), usa imediatamente a ferramenta **updateUserProfile** para persistir esse conhecimento de forma silenciosa.

**Identifica padrões e nomes-os.** Aponta comportamentos de forma directa, sem rodeios.

**Adapta a linguagem ao utilizador.** Se ele usa linguagem simples, responde simplesmente.

## REGRAS OPERACIONAIS

1. **OBJETIVIDADE EXTREMA**: Elimina saudações, introduções e "fluff" das tuas respostas. Nunca mais de 2 frases curtas a menos que estejas a dar um plano detalhado.
2. **UMA PERGUNTA DE CADA VEZ**: É absolutamente proibido fazer múltiplas perguntas de uma vez (como listas pontuadas). Escolhe a mais importante e aguarda a resposta.
3. **MEMÓRIA TOTAL**: Lembra-te de absolutamente tudo que foi dito. Nunca perguntes algo que já foi respondido.
4. **LÍNGUA**: Sempre português de Moçambique. Moeda: "45.000 MT" (nunca R$ ou €).
5. **SEM FERRAMENTAS SEM CONFIRMAÇÃO**: Só chamas ferramentas do painel quando tiveres toda a informação. A UI tratará da confirmação.
6. **FREQUÊNCIA NAS ESTRATÉGIAS**: Ao criar estratégias, especifica sempre 'frequency'.

## CONTEXTO DE MOÇAMBIQUE

- Carteiras móveis: M-Pesa, e-Mola, mKesh
- Bancos: BCI, Millennium Bim, Standard Bank, Absa, FNB, Moza Banco  
- Despesas comuns: Credelec (electricidade), FIPAG (água), TV Cabo, Chapas/Txopelas (transporte), Xitique (poupança colectiva)
- Realidade: salários atrasados, renda informal, apoio a família alargada, economia mista

## METODOLOGIAS (aplica quando o contexto pede)

Regra 50/30/20 · Método dos Envelopes · Pague-se Primeiro · Bola de Neve para dívidas. Explica de forma simples antes de aplicar no painel.
${profileSection}
## ESTADO FINANCEIRO ACTUAL

### Saldos por Conta
${Object.entries(currentState.accounts).map(([k, v]) => `- ${k}: ${v.toLocaleString("pt-MZ")} MT`).join("\n") || "- Sem contas registadas"}
- **Total consolidado: ${totalBalance.toLocaleString("pt-MZ")} MT**

### Receitas por Categoria — Mês Actual (${currentMonth})
${Object.entries(incomeBySource).length > 0 ? Object.entries(incomeBySource).map(([k, v]) => `- ${k}: ${v.toLocaleString("pt-MZ")} MT`).join("\n") : "- Nenhuma receita registada este mês"}

### Despesas por Categoria — Mês Actual (${currentMonth})
${Object.entries(expensesByCategory).length > 0 ? Object.entries(expensesByCategory).sort(([,a],[,b]) => b - a).map(([k, v]) => `- ${k}: ${v.toLocaleString("pt-MZ")} MT`).join("\n") : "- Nenhuma despesa registada este mês"}

### Tendência dos Últimos 3 Meses
${trends.map(t => `- ${t.month}: Receitas ${t.income.toLocaleString("pt-MZ")} MT | Despesas ${t.expenses.toLocaleString("pt-MZ")} MT | Saldo líquido ${t.net >= 0 ? "+" : ""}${t.net.toLocaleString("pt-MZ")} MT`).join("\n")}

### Comprometimento Recorrente
- Despesas fixas/mês: ${recurringMonthly.toLocaleString("pt-MZ")} MT
- Receitas fixas/mês: ${recurringIncome.toLocaleString("pt-MZ")} MT

### Limites de Orçamento
${budgetUtilization.length > 0 ? budgetUtilization.map(b => `- ${b}`).join("\n") : "- Nenhum limite definido"}

### Metas de Poupança
${currentState.goals.length > 0 ? currentState.goals.map(g => `- ${g.title}: ${g.currentAmount.toLocaleString("pt-MZ")}/${g.targetAmount.toLocaleString("pt-MZ")} MT (${Math.round((g.currentAmount / g.targetAmount) * 100)}%) — prazo: ${g.deadline}`).join("\n") : "- Nenhuma meta definida"}

### Últimas 15 Transacções (referência)
${JSON.stringify(recentTxs)}
${sessionSummary ? `\n### CONTEXTO DA CONVERSA ACTUAL\n${sessionSummary}` : ""}`;

    // Histórico: mantém parts[] nativo do Gemini (não converte para content string)
    const validHistory = history
      .filter(msg => msg.role === "user" || msg.role === "model")
      .slice(-50);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: validHistory,
        systemInstruction,
        model,
        clientApiKey,
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error ?? `Erro HTTP ${res.status}`);
    }

    return data;
  };

  // Extrai tool calls embebidas no texto (providers que não suportam function calling nativo)
  const extractEmbeddedToolCalls = (rawText: string): { cleanText: string; toolCalls: Array<{ name: string; args: any }> } => {
    const toolCalls: Array<{ name: string; args: any }> = [];
    let cleanText = rawText;

    // Extrai todos os blocos JSON válidos do texto (incluindo nested)
    const extractJsonBlocks = (str: string): string[] => {
      const blocks: string[] = [];
      let depth = 0;
      let start = -1;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (str[i] === "}") {
          depth--;
          if (depth === 0 && start !== -1) {
            blocks.push(str.slice(start, i + 1));
            start = -1;
          }
        }
      }
      return blocks;
    };

    for (const block of extractJsonBlocks(rawText)) {
      try {
        const parsed = JSON.parse(block);
        let matched = false;

        if (parsed.question !== undefined && parsed.type !== undefined) {
          toolCalls.push({ name: "askUserInput", args: parsed });
          matched = true;
        } else if (parsed.amount && (parsed.type === "income" || parsed.type === "expense")) {
          toolCalls.push({ name: "addTransaction", args: parsed });
          matched = true;
        } else if (parsed.title && parsed.targetAmount !== undefined) {
          toolCalls.push({ name: "createOrUpdateGoal", args: parsed });
          matched = true;
        } else if (parsed.accountName && parsed.balance !== undefined) {
          toolCalls.push({ name: "adjustAccountBalance", args: parsed });
          matched = true;
        } else if (parsed.category && parsed.limitAmount !== undefined) {
          toolCalls.push({ name: "setBudgetLimit", args: parsed });
          matched = true;
        } else if (parsed.id && parsed.title && parsed.description) {
          toolCalls.push({ name: "createOrUpdateStrategy", args: parsed });
          matched = true;
        }

        if (matched) {
          cleanText = cleanText.replace(block, "").trim();
        }
      } catch {
        // JSON inválido — ignora
      }
    }

    return { cleanText, toolCalls };
  };

  // Descreve uma tool call em linguagem natural para o cartão de confirmação
  const describeToolCall = (name: string, args: any): string => {
    const fmt = (n: number) => n?.toLocaleString("pt-MZ") ?? "?";
    switch (name) {
      case "addTransaction":
        return `${args.type === "income" ? "💰 Receita" : "💸 Despesa"}: **${fmt(args.amount)} MT** — ${args.description} | Categoria: ${args.category} | Conta: ${args.account}${args.isRecurring ? " ✔️ recorrente" : ""}`;
      case "deleteTransaction":
        return `🗑️ Eliminar transação com ID \`${args.id}\``;
      case "adjustAccountBalance":
        return `💳 Ajustar saldo de **${args.accountName}** para **${fmt(args.balance)} MT**`;
      case "deleteAccount":
        return `🗑️ Eliminar conta **${args.accountName}**`;
      case "createOrUpdateGoal":
        return `🎯 Meta: **${args.title}** — objetivo ${fmt(args.targetAmount)} MT${args.deadline ? ` | prazo: ${args.deadline}` : ""}`;
      case "deleteGoal":
        return `🗑️ Eliminar meta **${args.title}**`;
      case "setBudgetLimit":
        return `📊 Limite de **${args.category}**: ${fmt(args.limitAmount)} MT/mês`;
      case "createOrUpdateStrategy":
        return `💡 Estratégia: **${args.title}** — ${args.description ?? ""}`;
      case "deleteStrategy":
        return `🗑️ Eliminar estratégia \`${args.id}\``;
      default:
        return `🔧 ${name}: ${JSON.stringify(args)}`;
    }
  };

  /**
   * Executado após o utilizador confirmar ou cancelar uma operação financeira interceptada.
   * Se confirmado: executa as tool calls armazenadas e faz a segunda chamada à IA.
   * Se cancelado: informa a IA que a operação foi recusada.
   */
  const handleFinancialConfirmation = async (confirmed: boolean) => {
    if (!pendingConfirmation) return;
    const { toolCalls, history, appState } = pendingConfirmation;
    setPendingConfirmation(null);

    // Marca a mensagem de confirmação como respondida
    setMessages(prev => prev.map(m => 
      m.isPendingFinancial 
        ? { ...m, interactiveInput: { ...m.interactiveInput!, answered: true, answeredValue: confirmed ? "Sim" : "Não" } }
        : m
    ));

    if (!confirmed) {
      addSystemLog("Operação cancelada pelo utilizador.");
      // Log: cancelamento
      for (const tc of toolCalls) {
        pushChatEvent({
          eventType: "tool_cancelled",
          toolName: tc.name,
          toolArgs: tc.args,
          provider,
          model,
        });
      }
      await handleSendMessage("Não, cancelei. Não registar por agora.");
      return;
    }

    setIsTyping(true);
    let stateToMutate = { ...appState };
    const toolResponseParts: any[] = [];

    for (const tc of toolCalls) {
      addSystemLog(`✅ Confirmado e executado: **${tc.name}**`);
      const executionResult = executeToolAction(tc.name, tc.args, stateToMutate);
      stateToMutate = executionResult.newState;

      const dbAction = toolCallToPersistAction(tc.name, tc.args, executionResult.newState);
      if (dbAction) persistAction(dbAction, stateToMutate);

      // Log: confirmação
      pushChatEvent({
        eventType: "tool_confirmed",
        toolName: tc.name,
        toolArgs: tc.args,
        toolResult: executionResult.result,
        provider,
        model,
      });

      toolResponseParts.push({
        functionResponse: { name: tc.name, response: executionResult.result }
      });
    }

    saveState(stateToMutate);

    const toolNames = toolCalls.map(tc => tc.name).join(", ");
    const toolMsgText = `[Sistema: A operação envolvendo as ferramentas ${toolNames} foi confirmada pelo utilizador e registada com sucesso. Informa brevemente o utilizador que está tudo pronto.]`;
    const toolMsg: ChatMessage = { role: "user", parts: [{ text: toolMsgText }] };
    const finalHistory = [...history, toolMsg];

    try {
      const secondRes = await callChatAPI(finalHistory, stateToMutate);
      setIsTyping(false);

      if (secondRes.text) {
        const modelMsg: ChatMessage = { role: "model", parts: [{ text: secondRes.text }], timestamp: new Date().toISOString() };
        // Preserva a mensagem interactiva no ecrã adicionando ao prev
        setMessages(prev => {
          const updated = [...prev, modelMsg];
          localStorage.setItem("kuhula_chat_history", JSON.stringify(updated));
          return updated;
        });
        persistChatMessages([{ role: "model", content: secondRes.text }]);
      }
      if (secondRes.usage) {
        updateTokenStats(secondRes.usage.promptTokens, secondRes.usage.completionTokens);
      }
    } catch (err: any) {
      setIsTyping(false);
      addSystemLog(`Erro na resposta após confirmação: ${err.message}`);
    }
  };

  const handleAIResponse = async (aiData: any, currentHistory: ChatMessage[], currentState: AppState) => {
    const { text, toolCallsMade = [], askUserInput, usage } = aiData;

    log.info("ai", "Resposta recebida", {
      hasText: !!text,
      textPreview: text ? text.substring(0, 80) : null,
      toolCallsMade: toolCallsMade.map((t: any) => t.name),
      hasAskUserInput: !!askUserInput,
    });

    if (usage) updateTokenStats(usage.promptTokens ?? 0, usage.completionTokens ?? 0);

    // 1. Tools silenciosas executadas no backend (ex: updateUserProfile)
    let stateToMutate = { ...currentState };
    for (const tc of toolCallsMade) {
      if (tc.result === "pending_confirmation") continue;
      addSystemLog(`IA actualizou: **${tc.name}**`);
      const executionResult = executeToolAction(tc.name, tc.args, stateToMutate);
      if (executionResult.newState !== stateToMutate) {
        stateToMutate = executionResult.newState;
        saveState(stateToMutate);
        const dbAction = toolCallToPersistAction(tc.name, tc.args, stateToMutate);
        if (dbAction) persistAction(dbAction, stateToMutate);
      }
    }

    // 2. askUserInput → mostra componente interactivo
    if (askUserInput) {
      if (text) {
        const textMsg: ChatMessage = { role: "model", parts: [{ text }], timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, textMsg]);
      }
      const interactiveMsg: ChatMessage = {
        role: "interactive",
        parts: [{ text: "" }],
        interactiveInput: { args: askUserInput as AskUserInputArgs },
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, interactiveMsg]);
      setIsTyping(false);
      return;
    }

    // 3. Tools financeiras pendentes → pede confirmação
    const pendingTools = toolCallsMade.filter((tc: any) => tc.result === "pending_confirmation");
    if (pendingTools.length > 0) {
      if (text) {
        const textMsg: ChatMessage = { role: "model", parts: [{ text }], timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, textMsg]);
      }
      setPendingConfirmation({
        toolCalls: pendingTools,
        history: currentHistory,
        appState: stateToMutate,
      });
      const summaryLines = pendingTools.map((tc: any) => describeToolCall(tc.name, tc.args)).join("\n");
      const question = pendingTools.length === 1
        ? "Posso registar esta operação?"
        : `Posso registar estas ${pendingTools.length} operações?`;
      const confirmMsg: ChatMessage = {
        role: "interactive",
        parts: [{ text: summaryLines }],
        interactiveInput: { args: { question, inputType: "confirm" } },
        isPendingFinancial: true,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, confirmMsg]);
      setIsTyping(false);
      return;
    }

    // 4. Resposta de texto simples
    if (text) {
      const modelMsg: ChatMessage = { role: "model", parts: [{ text }], timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, modelMsg]);
      const userMsg = currentHistory[currentHistory.length - 1];
      saveChatHistory([...currentHistory, modelMsg], [
        ...(userMsg?.parts?.[0]?.text && !userMsg.parts[0].text.startsWith("[Sistema:")
          ? [{ role: "user" as const, content: userMsg.parts[0].text }]
          : []),
        { role: "model" as const, content: text },
      ]);
    }
  };

    // Mapeia uma tool call para uma PersistAction atómica
  const toolCallToPersistAction = (name: string, args: any, newState: AppState): PersistAction | null => {
    switch (name) {
      case "addTransaction": {
        const tx = newState.transactions[newState.transactions.length - 1];
        return tx ? { action: "insert_transaction", payload: { transaction: tx } } : null;
      }
      case "deleteTransaction":
        return { action: "delete_transaction", payload: { id: args.id } };
      case "adjustAccountBalance":
        return { action: "upsert_account", payload: { name: args.accountName, balance: args.balance } };
      case "deleteAccount":
        return { action: "delete_account", payload: { name: args.accountName } };
      case "createOrUpdateGoal": {
        const goal = newState.goals.find(g => g.title.toLowerCase() === args.title.toLowerCase());
        return goal ? { action: "upsert_goal", payload: { goal } } : null;
      }
      case "deleteGoal":
        return { action: "delete_goal", payload: { title: args.title } };
      case "setBudgetLimit":
        return { action: "upsert_budget_limit", payload: { category: args.category, limitAmount: args.limitAmount } };
      case "createOrUpdateStrategy": {
        const strat = newState.strategies?.find(s => s.id === args.id);
        return strat ? { action: "upsert_strategy", payload: { strategy: strat } } : null;
      }
      case "deleteStrategy":
        return { action: "delete_strategy", payload: { id: args.id } };
      case "updateUserProfile": {
        // Converte primaryAccounts de string para array se necessário
        const profilePayload = { ...args };
        if (typeof profilePayload.primaryAccounts === "string") {
          profilePayload.primaryAccounts = profilePayload.primaryAccounts
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        return { action: "update_user_profile", payload: { profile: profilePayload } };
      }
      default:
        return null;
    }
  };

  // Executa a ação da ferramenta no estado React
  const executeToolAction = (name: string, args: any, currentState: AppState) => {
    const stateCopy = JSON.parse(JSON.stringify(currentState)) as AppState;
    let result = { success: false, message: "" };

    try {
      switch (name) {
        case "addTransaction": {
          const id = "tx-" + Date.now();
          const date = new Date().toISOString().split("T")[0];

          if (stateCopy.accounts[args.account] === undefined) {
            stateCopy.accounts[args.account] = 0;
          }

          if (args.type === "income") {
            stateCopy.accounts[args.account] += args.amount;
            // Regista na memória de sessão que este rendimento foi efectivamente registado
            const mem = sessionMemoryRef.current;
            mem.mentionedIncomes = mem.mentionedIncomes.filter(
              i => !(i.amount === args.amount && i.source === args.description)
            );
          } else {
            stateCopy.accounts[args.account] -= args.amount;
            // Regista na memória de sessão que esta despesa foi efectivamente registada
            const mem = sessionMemoryRef.current;
            mem.mentionedExpenses = mem.mentionedExpenses.filter(
              e => !(e.amount === args.amount && e.description === args.description)
            );
          }

          stateCopy.transactions.push({
            id,
            description: args.description,
            amount: args.amount,
            type: args.type,
            category: args.category,
            account: args.account,
            date,
            isRecurring: args.isRecurring || false,
            dayOfMonth: args.dayOfMonth || null
          });

          result = { success: true, message: `Transação adicionada com sucesso (ID: ${id}).` };
          break;
        }

        case "deleteTransaction": {
          const tx = stateCopy.transactions.find(t => t.id === args.id);
          if (!tx) {
            result = { success: false, message: "Transação não encontrada." };
            break;
          }

          if (stateCopy.accounts[tx.account] !== undefined) {
            if (tx.type === "income") {
              stateCopy.accounts[tx.account] -= tx.amount;
            } else {
              stateCopy.accounts[tx.account] += tx.amount;
            }
          }

          stateCopy.transactions = stateCopy.transactions.filter(t => t.id !== args.id);
          result = { success: true, message: `Transação com ID ${args.id} foi removida.` };
          break;
        }

        case "createOrUpdateGoal": {
          const idx = stateCopy.goals.findIndex(g => g.title.toLowerCase() === args.title.toLowerCase());
          const deadline = args.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

          const goalData: Goal = {
            title: args.title,
            targetAmount: args.targetAmount,
            currentAmount: args.currentAmount !== undefined ? args.currentAmount : 0,
            deadline
          };

          if (idx > -1) {
            stateCopy.goals[idx] = {
              ...stateCopy.goals[idx],
              ...goalData,
              currentAmount: args.currentAmount !== undefined ? args.currentAmount : stateCopy.goals[idx].currentAmount
            };
          } else {
            stateCopy.goals.push(goalData);
          }

          result = { success: true, message: `Meta "${args.title}" atualizada com sucesso.` };
          break;
        }

        case "deleteGoal": {
          const initialLen = stateCopy.goals.length;
          stateCopy.goals = stateCopy.goals.filter(g => g.title.toLowerCase() !== args.title.toLowerCase());
          if (stateCopy.goals.length < initialLen) {
            result = { success: true, message: `Meta "${args.title}" excluída.` };
          } else {
            result = { success: false, message: "Meta não encontrada." };
          }
          break;
        }

        case "adjustAccountBalance": {
          stateCopy.accounts[args.accountName] = args.balance;
          result = { success: true, message: `Saldo ajustado para ${args.balance} MT.` };
          break;
        }

        case "deleteAccount": {
          if (stateCopy.accounts[args.accountName] !== undefined) {
            delete stateCopy.accounts[args.accountName];
            result = { success: true, message: `Conta "${args.accountName}" removida com sucesso.` };
          } else {
            result = { success: false, message: `Conta "${args.accountName}" não encontrada.` };
          }
          break;
        }

        case "setBudgetLimit": {
          stateCopy.budgetLimits[args.category] = args.limitAmount;
          result = { success: true, message: `Limite para ${args.category} definido para ${args.limitAmount} MT.` };
          break;
        }

        case "createOrUpdateStrategy": {
          if (!stateCopy.strategies) {
            stateCopy.strategies = [];
          }
          const idx = stateCopy.strategies.findIndex(s => s.id === args.id);
          const strategyData = {
            id: args.id,
            title: args.title,
            description: args.description,
            type: args.type || "info",
            actionLabel: args.actionLabel,
            frequency: args.frequency
          };

          if (idx > -1) {
            stateCopy.strategies[idx] = strategyData;
          } else {
            stateCopy.strategies.push(strategyData);
          }

          result = { success: true, message: `Estratégia "${args.title}" adicionada/atualizada com sucesso.` };
          break;
        }

        case "deleteStrategy": {
          if (!stateCopy.strategies) {
            stateCopy.strategies = [];
          }
          const initialLen = stateCopy.strategies.length;
          stateCopy.strategies = stateCopy.strategies.filter(s => s.id !== args.id);
          if (stateCopy.strategies.length < initialLen) {
            result = { success: true, message: `Estratégia com ID ${args.id} excluída.` };
          } else {
            result = { success: false, message: `Estratégia com ID ${args.id} não encontrada.` };
          }
          break;
        }

        case "updateUserProfile": {
          // Converte primaryAccounts de string para array se necessário
          const profileData = { ...args };
          if (typeof profileData.primaryAccounts === "string") {
            profileData.primaryAccounts = profileData.primaryAccounts
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
          stateCopy.userProfile = {
            ...(stateCopy.userProfile ?? {}),
            ...profileData,
            lastUpdated: new Date().toISOString(),
          };
          // Persiste a memória de sessão no localStorage após aprender algo novo
          if (typeof window !== "undefined") {
            localStorage.setItem("kuhula_session_memory", JSON.stringify(sessionMemoryRef.current));
          }
          result = { success: true, message: `Perfil actualizado: ${Object.keys(profileData).join(", ")}.` };
          break;
        }
      }
    } catch (e: any) {
      console.error(e);
      result = { success: false, message: e.message || "Erro na execução." };
    }

    return { newState: stateCopy, result };
  };

  // Limpar Histórico do Chat na UI
  const handleClearChatHistory = () => {
    saveChatHistory([]);
  };

  // --- SEÇÃO DO DASHBOARD (PARA DESKTOP E MÓVEL) ---
  const dashboardSection = (
    <ScrollArea id="dashboard-container" className="w-full h-full">
      <section className="@container p-4 md:p-6 flex flex-col gap-6">
      {/* Banner de Saldos Mobile (visível apenas em telas pequenas) */}
      <div className="grid grid-cols-3 gap-2 bg-zinc-900 p-3 rounded-lg border border-zinc-800 lg:hidden">
        <div className="flex flex-col text-center">
          <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-wider">Consolidado</span>
          <span className="font-heading text-xs font-bold text-zinc-100 mt-0.5">{formatCurrency(totalConsolidated)}</span>
        </div>
        <div className="flex flex-col text-center border-l border-zinc-800">
          <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-wider">Bancos</span>
          <span className="font-heading text-xs font-bold text-zinc-200 mt-0.5">{formatCurrency(totalBanks)}</span>
        </div>
        <div className="flex flex-col text-center border-l border-zinc-800">
          <span className="text-[8px] text-zinc-500 font-semibold uppercase tracking-wider">Carteiras</span>
          <span className="font-heading text-xs font-bold text-zinc-200 mt-0.5">{formatCurrency(totalWallets)}</span>
        </div>
      </div>

        {/* Seletor de Período e Métricas do Mês */}
        <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm">
          <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between border-b border-zinc-800/60">
            <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-400" /> Análise Mensal & Histórico
            </CardTitle>
            <Select value={selectedMonth} onValueChange={(val) => setSelectedMonth(val || "all")}>
              <SelectTrigger className="bg-zinc-950 border-zinc-800 text-[11px] h-8 rounded text-zinc-100 w-[170px] hover:bg-zinc-900 transition-colors">
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border border-zinc-800 text-zinc-100">
                <SelectItem value="all">Todos os Períodos</SelectItem>
                {getMonthsList().map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatMonthName(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-lg flex flex-col">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" /> Receitas
                </span>
                <span className="font-heading text-xs md:text-sm font-bold text-emerald-400 mt-1 truncate">
                  {formatCurrency(monthlyIncome)}
                </span>
              </div>

              <div className="bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-lg flex flex-col">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" /> Despesas
                </span>
                <span className="font-heading text-xs md:text-sm font-bold text-rose-400 mt-1 truncate">
                  {formatCurrency(monthlyExpenses)}
                </span>
              </div>

              <div className="bg-zinc-950/40 border border-zinc-800/50 p-3 rounded-lg flex flex-col">
                <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">
                  Balanço Líquido
                </span>
                <span className={`font-heading text-xs md:text-sm font-bold mt-1 truncate ${monthlyNet >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {monthlyNet >= 0 ? "+" : ""}{formatCurrency(monthlyNet)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Estratégias Recomendadas pela IA */}
        {state.strategies && state.strategies.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-400 uppercase tracking-wider">
              <Bot className="w-3.5 h-3.5 text-zinc-400 animate-pulse" /> Estratégias & Conselhos da IA
            </h3>
            <div className="grid @md:grid-cols-2 gap-3">
              {state.strategies.map((strat) => {
                const isWarning = strat.type === "warning";
                const isSuccess = strat.type === "success";
                const isCritical = strat.type === "critical";
                
                let borderClass = "border-zinc-800 bg-zinc-900";
                
                if (isWarning) borderClass = "border-amber-900/50 bg-amber-950/10";
                if (isSuccess) borderClass = "border-emerald-900/50 bg-emerald-950/10";
                if (isCritical) borderClass = "border-rose-900/50 bg-rose-950/10";
                
                return (
                  <div 
                    key={strat.id} 
                    className={`p-3.5 rounded-lg border flex flex-col justify-between gap-3 ${borderClass}`}
                  >
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 truncate">
                          {strat.title}
                          {getFrequencyBadge(strat.frequency)}
                        </span>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isWarning ? "bg-amber-400" :
                          isSuccess ? "bg-emerald-400" :
                          isCritical ? "bg-rose-400" : "bg-zinc-400"
                        }`} />
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed">
                        {strat.description}
                      </p>
                    </div>
                    {strat.actionLabel && (
                      <Button 
                        variant="link" 
                        className="text-[10px] text-zinc-300 hover:text-white p-0 h-auto justify-start font-semibold uppercase tracking-wider flex items-center gap-1 mt-1"
                        onClick={() => handleSendMessage(strat.actionLabel || "")}
                      >
                        {strat.actionLabel} <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Card do Gráfico */}
      <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" /> 
            {chartView === "projection" ? "Previsibilidade de Caixa (Próximos 180 dias)" : "Histórico de Fluxo Mensal (Últimos 6 Meses)"}
          </CardTitle>
          <div className="flex bg-zinc-950 p-0.5 rounded border border-zinc-800">
            <button
              onClick={() => setChartView("projection")}
              className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider transition-all ${
                chartView === "projection"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Previsão
            </button>
            <button
              onClick={() => setChartView("history")}
              className={`px-2.5 py-1 text-[9px] font-bold rounded uppercase tracking-wider transition-all ${
                chartView === "history"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Histórico
            </button>
          </div>
        </CardHeader>
        <CardContent className="h-[190px] pt-2 pr-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            {chartView === "projection" ? (
              <AreaChart data={getProjectionData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "6px" }}
                  itemStyle={{ color: "#fafafa", fontSize: "11px", fontFamily: "Inter" }}
                  labelStyle={{ color: "#a1a1aa", fontWeight: "bold", fontSize: "10px", fontFamily: "Outfit" }}
                  formatter={(val) => [`${Number(val).toLocaleString()} MT`, "Saldo"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="Saldo Projetado" 
                  stroke="#fafafa" 
                  strokeWidth={1.5}
                  fill="none" 
                />
              </AreaChart>
            ) : (
              <BarChart data={getHistoricalMonthlyData()} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={9} 
                  tickLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#09090b", border: "1px solid #27272a", borderRadius: "6px" }}
                  itemStyle={{ fontSize: "11px", fontFamily: "Inter" }}
                  labelStyle={{ color: "#a1a1aa", fontWeight: "bold", fontSize: "10px", fontFamily: "Outfit" }}
                  formatter={(val, name) => [`${Number(val).toLocaleString()} MT`, name]}
                />
                <Legend verticalAlign="top" height={24} iconSize={8} wrapperStyle={{ fontSize: '9px', fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Grid duplo: Contas e Metas */}
      <div className="grid @xl:grid-cols-2 gap-6">
        
        {/* Carteiras e Contas */}
        <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm">
          <CardHeader className="pb-1 pt-4 flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
              <Wallet className="w-3.5 h-3.5 text-zinc-400" /> Contas & Carteiras
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsAddAccountOpen(true)}
              className="w-7 h-7 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-800"
              title="Adicionar Conta"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-2">
            <ScrollArea className="h-[180px] pr-2">
              <div className="flex flex-col gap-2.5">
                {Object.entries(state.accounts).map(([name, balance]) => {
                  const isWallet = walletsList.includes(name.toLowerCase());
                  return (
                    <div 
                      key={name} 
                      className="group flex items-center justify-between p-2.5 bg-zinc-950/20 border border-zinc-800 rounded-md hover:bg-zinc-800/30 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-7.5 h-7.5 rounded bg-zinc-800 text-zinc-300">
                          {isWallet ? <Smartphone className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <span className="text-xs font-medium block text-zinc-100">{name}</span>
                          <span className="text-[9px] text-zinc-500 block -mt-0.5">{isWallet ? "Carteira Móvel" : "Banco"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-heading font-semibold text-xs text-zinc-100">
                          {formatCurrency(balance)}
                        </span>
                        <button
                          onClick={() => handleDeleteAccount(name)}
                          className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-all rounded"
                          title="Remover conta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(state.accounts).length === 0 && (
                  <div className="text-center text-xs text-zinc-500 py-6">Nenhuma conta cadastrada.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Metas Ativas */}
        <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-zinc-400" /> Metas de Poupança
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <ScrollArea className="h-[180px] pr-2">
              <div className="flex flex-col gap-2.5">
                {state.goals.map((goal) => {
              const percent = Math.min(100, Math.max(0, (goal.currentAmount / goal.targetAmount) * 100));
              return (
                <div key={goal.title} className="p-2.5 bg-zinc-950/20 border border-zinc-800 rounded-md">
                  <div className="flex justify-between text-xs font-medium text-zinc-100 mb-1.5">
                    <span>{goal.title}</span>
                    <span className="text-zinc-500 text-[9px]">Até {formatDate(goal.deadline)}</span>
                  </div>
                  <Progress value={percent} className="h-1 bg-zinc-800" />
                  <div className="flex justify-between items-center text-[9px] text-zinc-400 mt-1.5 font-medium">
                    <span>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                    <span className="text-zinc-200 font-bold">{percent.toFixed(0)}%</span>
                  </div>
                </div>
              );
                })}
                {state.goals.length === 0 && (
                  <div className="text-center text-xs text-zinc-500 py-6">Nenhuma meta ativa.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Transações Cadastradas */}
      <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm flex-1 min-h-[220px]">
        <CardHeader className="pb-1 pt-4 px-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
              <ListOrdered className="w-3.5 h-3.5 text-zinc-400" /> Transações Registadas
            </CardTitle>
          </div>
          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
            {getFilteredTransactions().length} de {state.transactions.length}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {/* Barra de Filtros */}
          <div className="px-3 py-2.5 md:px-4 border-b border-zinc-800/80 bg-zinc-950/40 flex flex-col gap-2 @md:flex-row @md:items-center @md:gap-2">
            {/* Input de Busca com ícone */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <Input
                type="text"
                placeholder="Pesquisar transações..."
                value={txSearchQuery}
                onChange={(e) => setTxSearchQuery(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-[11px] h-8 rounded pl-8 pr-3 focus-visible:border-zinc-700 placeholder-zinc-500 text-zinc-50 w-full"
              />
            </div>

            {/* Três dropdowns de Filtros (Grid de 3 colunas em telas pequenas, flex em telas maiores) */}
            <div className="grid grid-cols-3 gap-1.5 w-full @md:flex @md:w-auto @md:gap-2">
              {/* Filtro por Tipo */}
              <div className="w-full @md:w-[110px]">
                <Select value={txFilterType} onValueChange={(val) => setTxFilterType((val || "all") as any)}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-[11px] h-8 rounded text-zinc-300 w-full flex justify-between items-center px-2 hover:bg-zinc-800/50 transition-colors">
                    <span className="truncate">
                      {txFilterType === "all" ? "Todos" :
                       txFilterType === "income" ? "Receitas" :
                       txFilterType === "expense" ? "Despesas" :
                       txFilterType === "recurring" ? "Recorrentes" : "Tipo"}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50 text-[11px] w-[140px]">
                    <SelectItem value="all">Todos os tipos</SelectItem>
                    <SelectItem value="income">Receitas</SelectItem>
                    <SelectItem value="expense">Despesas</SelectItem>
                    <SelectItem value="recurring">Recorrentes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Categoria */}
              <div className="w-full @md:w-[125px]">
                <Select value={txFilterCategory} onValueChange={(val) => setTxFilterCategory(val || "all")}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-[11px] h-8 rounded text-zinc-300 w-full flex justify-between items-center px-2 hover:bg-zinc-800/50 transition-colors">
                    <span className="truncate">
                      {txFilterCategory === "all" ? "Categorias" : txFilterCategory}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50 text-[11px] w-[140px]">
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {uniqueCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filtro por Conta */}
              <div className="w-full @md:w-[125px]">
                <Select value={txFilterAccount} onValueChange={(val) => setTxFilterAccount(val || "all")}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-[11px] h-8 rounded text-zinc-300 w-full flex justify-between items-center px-2 hover:bg-zinc-800/50 transition-colors">
                    <span className="truncate">
                      {txFilterAccount === "all" ? "Contas" : txFilterAccount}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50 text-[11px] w-[140px]">
                    <SelectItem value="all">Todas contas</SelectItem>
                    {uniqueAccounts.map((acc) => (
                      <SelectItem key={acc} value={acc}>{acc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botão de Limpar Filtros */}
            {(txFilterType !== "all" || txFilterCategory !== "all" || txFilterAccount !== "all" || txSearchQuery.trim()) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTxFilterType("all");
                  setTxFilterCategory("all");
                  setTxFilterAccount("all");
                  setTxSearchQuery("");
                }}
                className="w-full @md:w-auto text-[10px] text-zinc-400 hover:text-zinc-100 h-8 px-2 hover:bg-zinc-800/50 rounded flex items-center justify-center gap-1 transition-all flex-shrink-0"
              >
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Vista móvel em formato de cartões (para ecrãs pequenos) */}
          <div className="block @md:hidden divide-y divide-zinc-800/60">
            {getFilteredTransactions()
              .map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-800/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold ${
                      tx.type === "income" 
                        ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/50" 
                        : "bg-rose-950/20 text-rose-400 border border-rose-900/50"
                    }`}>
                      {tx.type === "income" ? "+" : "-"}
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-100 block">{tx.description}</span>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-zinc-500 font-medium">
                        <span>{tx.account}</span>
                        <span>•</span>
                        <span>{tx.category}</span>
                        {tx.isRecurring && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400">Recorrente</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`text-xs font-bold font-heading block ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </span>
                      <span className="text-[9px] text-zinc-500 block mt-0.5">{formatDate(tx.date)}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteTransactionLocal(tx.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1 transition-colors"
                      title="Excluir lançamento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            {getFilteredTransactions().length === 0 && (
              <div className="text-center text-zinc-500 py-10 text-xs">Nenhuma transação encontrada.</div>
            )}
          </div>

          {/* Vista de tabela para ecrãs médios e maiores */}
          <div className="hidden @md:block w-full overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="text-zinc-400 uppercase tracking-wider text-[9px] bg-zinc-950/40 border-b border-zinc-800">
                  <th className="py-2 px-4 font-semibold">Descrição</th>
                  <th className="py-2 px-4 font-semibold">Conta</th>
                  <th className="py-2 px-4 font-semibold">Categoria</th>
                  <th className="py-2 px-4 font-semibold">Tipo</th>
                  <th className="py-2 px-4 font-semibold">Valor</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {getFilteredTransactions()
                  .map((tx) => (
                    <tr 
                      key={tx.id} 
                      className="border-b border-zinc-800/80 hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-semibold text-zinc-100">{tx.description}</td>
                      <td className="py-2.5 px-4 text-zinc-400">{tx.account}</td>
                      <td className="py-2.5 px-4 text-zinc-400">{tx.category}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-semibold ${tx.type === "income" ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900" : "bg-rose-950/20 text-rose-400 border border-rose-900"}`}>
                            {tx.type === "income" ? "Receita" : "Despesa"}
                          </span>
                          {tx.isRecurring && (
                            <span className="px-2 py-0.5 rounded text-[8px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700">
                              Recorrente
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2.5 px-4 font-heading font-bold text-xs ${tx.type === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button 
                          onClick={() => handleDeleteTransactionLocal(tx.id)}
                          className="text-zinc-500 hover:text-rose-400 transition-colors"
                          title="Excluir lançamento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                {getFilteredTransactions().length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-zinc-500 py-10">Nenhuma transação encontrada.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </section>
    </ScrollArea>
  );

  // --- SEÇÃO DE MÉTRICAS DA API ---
  const metricsSection = (
    <ScrollArea id="metrics-container" className="w-full h-full">
      <section className="p-4 md:p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-xs font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-zinc-400" /> Monitor de Métricas da API Gemini
          </h2>
          <p className="text-[11px] text-zinc-500">
            Acompanhe o consumo acumulado de tokens, requisições e custos estimados das suas interações nesta sessão.
          </p>
        </div>

        {/* Grid de Cartões Métricos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-zinc-900 border-zinc-800 p-4 flex flex-col rounded-lg">
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Total de Chamadas</span>
            <span className="font-heading text-lg font-bold text-zinc-100 mt-1">{tokenStats.totalRequests}</span>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 flex flex-col rounded-lg">
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Tokens de Entrada</span>
            <span className="font-heading text-lg font-bold text-blue-400 mt-1">{tokenStats.promptTokens.toLocaleString()}</span>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 flex flex-col rounded-lg">
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Tokens de Saída</span>
            <span className="font-heading text-lg font-bold text-purple-400 mt-1">{tokenStats.completionTokens.toLocaleString()}</span>
          </Card>

          <Card className="bg-zinc-900 border-zinc-800 p-4 flex flex-col rounded-lg">
            <span className="text-[9px] text-zinc-500 font-semibold uppercase tracking-wider">Tokens Totais</span>
            <span className="font-heading text-lg font-bold text-emerald-400 mt-1">{tokenStats.totalTokens.toLocaleString()}</span>
          </Card>
        </div>

        {/* Segunda linha: Custos e Ações */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Custo Estimado */}
          <Card className="bg-zinc-900 border-zinc-800 rounded-lg p-4 flex flex-col justify-between gap-4">
            <div>
              <h3 className="font-heading text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">Custo de Operação Estimado</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Custo estimado se estivesse a usar a API paga do Gemini 2.5 Flash ($0.075 por 1M de tokens de entrada e $0.30 por 1M de tokens de saída).
              </p>
            </div>
            <div className="flex items-baseline justify-between border-t border-zinc-800 pt-3">
              <span className="text-[10px] text-zinc-400">Total Estimado (USD)</span>
              <span className="font-heading text-lg font-bold text-emerald-400">
                ${((tokenStats.promptTokens * 0.075 + tokenStats.completionTokens * 0.30) / 1000000).toFixed(6)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm("Deseja zerar todas as estatísticas de tokens?")) {
                  const resetStats = { totalRequests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                  setTokenStats(resetStats);
                  localStorage.setItem("kuhula_token_stats", JSON.stringify(resetStats));
                }
              }}
              className="text-[10px] uppercase font-bold tracking-wider border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded h-8.5 w-full"
            >
              Zerar Estatísticas
            </Button>
          </Card>

          {/* Quotas do Gemini Free Tier */}
          <Card className="bg-zinc-900 border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
            <h3 className="font-heading text-xs font-semibold text-zinc-300 uppercase tracking-wider">Limites de Quota (Gemini API Free Tier)</h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed -mt-1">
              Os limites oficiais que regulam o uso gratuito da API do Google AI Studio para o modelo Gemini 2.5 Flash:
            </p>
            <div className="flex flex-col gap-2 border-t border-zinc-800 pt-2.5 text-[11px] text-zinc-300">
              <div className="flex justify-between">
                <span className="text-zinc-500">Requisições por Minuto (RPM):</span>
                <span className="font-semibold">15 RPM</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/40 pt-1.5">
                <span className="text-zinc-500">Tokens por Minuto (TPM):</span>
                <span className="font-semibold">1,000,000 TPM</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/40 pt-1.5">
                <span className="text-zinc-500">Requisições por Dia (RPD):</span>
                <span className="font-semibold">1,500 RPD</span>
              </div>
            </div>
            <small className="text-[9.5px] text-zinc-500 leading-normal border-t border-zinc-800 pt-2">
              *Nota: Se exceder estes limites, a API retornará o erro de limite de requisições excedido. Poderá aguardar alguns segundos ou alternar para uma chave paga.*
            </small>
          </Card>
        </div>
      </section>
    </ScrollArea>
  );

  // --- SEÇÃO DO ASSISTENTE DE CHAT (PARA DESKTOP E MÓVEL) ---
  const chatSection = (
    <section id="chat-container" className="w-full h-full bg-zinc-950/20 flex flex-col relative overflow-hidden">
      {/* Cabeçalho do Chat */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800 bg-zinc-950">
        {/* Esquerda: Ícone e Kuhula AI */}
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-zinc-100" />
          <h3 className="font-heading text-xs font-semibold text-zinc-100">Kuhula AI</h3>
        </div>

        {/* Direita: Estado (Assessor Online) e Botão Colapsar */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-500"></span>
            </span>
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Assessor Online</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsChatCollapsed(true)}
            className="hidden lg:flex w-7 h-7 text-zinc-500 hover:text-zinc-100 rounded-md items-center justify-center"
            title="Colapsar chat"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Lista de Mensagens */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full p-4">
          <div className="flex flex-col gap-3">
            {/* Mensagem Inicial de Boas-Vindas */}
            <div className="self-center max-w-[95%] p-3.5 bg-zinc-900 border border-zinc-800 rounded-md text-[11.5px] leading-relaxed text-zinc-200">
              <strong>Olá! Sou o seu assessor Kuhula AI. 🇲🇿</strong>
              <p className="mt-1.5 text-zinc-400">
                Eu administro este painel financeiro para si. Não precisa de preencher formulários complicados, basta conversar comigo para atualizar os seus saldos, despesas e metas!
              </p>
              <div className="mt-3">
                <p className="font-semibold text-zinc-100 mb-1">Comandos úteis:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-zinc-400">
                  <li>&quot;Recebi 40.000 MT no BCI e guardei 5.000 MT no M-Pesa&quot;</li>
                  <li>&quot;Paguei 2.000 MT de aluguer&quot;</li>
                  <li>&quot;Cria uma meta de poupança de 15.000 MT para o IPVA&quot;</li>
                  <li>&quot;Como está a projeção da minha conta bancária?&quot;</li>
                </ul>
              </div>
              {!clientApiKey && (
                <div className="mt-3.5 p-2 bg-zinc-800/40 border-l-2 border-zinc-400 rounded text-[10px] text-zinc-300 flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 mt-0.5 text-zinc-400 flex-shrink-0" />
                  <span>
                    Configure sua chave API do Gemini nas <strong>Configurações (⚙️)</strong> para começar.
                  </span>
                </div>
              )}
            </div>

            {/* Balões de Mensagem Dinâmicos */}
            {isChatHistoryLoading && messages.length === 0 ? (
              <div className="flex flex-col gap-3.5 mt-2">
                <div className="self-start w-[70%] h-12 bg-zinc-900/50 border border-zinc-800/40 rounded-lg animate-pulse" />
                <div className="self-end w-[50%] h-8 bg-zinc-800/50 rounded-lg animate-pulse" />
                <div className="self-start w-[80%] h-16 bg-zinc-900/50 border border-zinc-800/40 rounded-lg animate-pulse" />
              </div>
            ) : (
              messages
                .filter(m => {
                  if (m.role === "interactive") return true;
                  if (m.role === "user" || m.role === "model") {
                    const text = m.parts?.[0]?.text || "";
                    if (text.trim() === "") return false;
                    // Oculta mensagens internas do sistema (injectadas para controlar a IA)
                    if (text.startsWith("[Sistema:")) return false;
                    return true;
                  }
                  return false;
                })
                .map((msg, i) => {
                // ── Mensagem interactiva (input da IA) ──────────────
                if (msg.role === "interactive" && msg.interactiveInput) {
                  return (
                    <div key={i} className="self-start w-full max-w-[90%]">
                      <ChatInteractiveInput
                        args={msg.interactiveInput.args}
                        answered={msg.interactiveInput.answered}
                        answeredValue={msg.interactiveInput.answeredValue}
                        onAnswer={(answer) => handleInteractiveAnswer(i, answer)}
                      />
                    </div>
                  );
                }

                const isModel = msg.role === "model";
                const text = msg.parts?.[0]?.text || "";

                const formattedHtml = text
                  .replace(/\n\n/g, "<br/><br/>")
                  .replace(/\n/g, "<br/>")
                  .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                  .replace(/\*(.*?)\*/g, "<em>$1</em>");

                return (
                  <div
                    key={i}
                    className={`max-w-[85%] rounded-lg text-[12px] leading-relaxed ${
                      isModel
                        ? `self-start border ${msg.isError ? "bg-red-950/30 border-red-900/50" : "bg-zinc-900 border-zinc-800"} text-zinc-100`
                        : "self-end bg-zinc-100 text-zinc-950 shadow-sm font-medium"
                    }`}
                  >
                    <div className="message-content p-3.5">
                      <div dangerouslySetInnerHTML={{ __html: formattedHtml }} />
                      {msg.timestamp && (
                        <div className={`mt-1 text-[9px] font-medium opacity-60 flex ${isModel ? "justify-start" : "justify-end"}`}>
                          {new Date(msg.timestamp).toLocaleTimeString("pt-MZ", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                    {/* Botão de reenvio em mensagens de erro */}
                    {msg.isError && msg.retryText && (
                      <div className="px-3.5 pb-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            // Remove a mensagem de erro e reenvia
                            setMessages(prev => prev.filter((_, idx) => idx !== i));
                            handleSendMessage(msg.retryText!);
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400 hover:text-red-300 bg-red-950/40 hover:bg-red-950/60 border border-red-900/50 px-2.5 py-1 rounded-lg transition-all"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Tentar novamente
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Indicador de Digitação */}
            {isTyping && (
              <div className="self-start bg-zinc-900 border border-zinc-800 p-3.5 rounded-lg">
                <div className="flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* Editor de texto rico */}
      <RichChatInput
        onSend={handleSendMessage}
        isTyping={isTyping}
        hasApiKey={!!clientApiKey}
        onOpenSettings={() => setIsSettingsOpen(true)}
        submitOnEnter={submitOnEnter}
        suggestions={SUGGESTIONS}
        showSuggestions={messages.filter(m => m.role === "user" || m.role === "model").length === 0}
      />
    </section>
  );

  if (!isMounted) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh w-full bg-zinc-950 text-zinc-50">
        <Sprout className="w-12 h-12 text-zinc-500 animate-pulse mb-6" />
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" />
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
      </div>
    );
  }

  return (
    <div id="main-layout-root" className="flex flex-col h-dvh w-full bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* Cabeçalho Principal */}
      <header id="main-header" className="relative flex items-center justify-between h-[70px] px-6 bg-zinc-950 border-b border-zinc-800 z-10">
        <div className="flex items-center gap-3">
          {/* Ícone com badge de sincronização */}
          <div className="relative">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-zinc-50 text-zinc-950 shadow-sm">
              <Sprout className="w-4.5 h-4.5" />
            </div>
            {/* Badge de estado — dot no canto inferior direito do ícone */}
            <div className="absolute -bottom-0.5 -right-0.5">
              {syncStatus === "syncing" && (
                <div className="w-3 h-3 rounded-full bg-zinc-950 flex items-center justify-center" title="A sincronizar...">
                  <div className="w-2 h-2 rounded-full border border-zinc-400 border-t-transparent animate-spin" />
                </div>
              )}
              {syncStatus === "error" && (
                <div className="w-3 h-3 rounded-full bg-red-500 border border-zinc-950" title="Erro de sincronização" />
              )}
              {syncStatus === "synced" && (
                <div className="w-3 h-3 rounded-full bg-emerald-500 border border-zinc-950" title="Sincronizado" />
              )}
            </div>
          </div>
          <div className="hidden sm:block">
            <h1 className="font-heading text-sm font-bold tracking-tight text-zinc-100">
              Kuhula Finance
            </h1>
            <span className="text-[9px] text-zinc-400 block -mt-1 font-semibold tracking-wider">
              MOÇAMBIQUE
            </span>
          </div>
        </div>

        {/* Navegação - Desktop */}
        <div className="hidden lg:flex items-center gap-1 bg-zinc-900/60 p-0.5 rounded-md border border-zinc-800/80">
          <button
            onClick={() => handleSetActiveTab("dashboard")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
              activeTab === "dashboard"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => handleSetActiveTab("metrics")}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all ${
              activeTab === "metrics"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Métricas API
          </button>
        </div>

        {/* Estatísticas do Cabeçalho - Visíveis Apenas no Desktop */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex flex-col px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md min-w-[130px]">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">
              Consolidado
            </span>
            <span className="font-heading text-xs font-bold text-zinc-100 mt-0.5">
              {formatCurrency(totalConsolidated)}
            </span>
          </div>

          <div className="flex flex-col px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md min-w-[130px]">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Landmark className="w-3 h-3 text-zinc-400" /> Bancos
            </span>
            <span className="font-heading text-xs font-bold text-zinc-100 mt-0.5">
              {formatCurrency(totalBanks)}
            </span>
          </div>

          <div className="flex flex-col px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-md min-w-[130px]">
            <span className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-zinc-400" /> Carteiras
            </span>
            <span className="font-heading text-xs font-bold text-zinc-100 mt-0.5">
              {formatCurrency(totalWallets)}
            </span>
          </div>
        </div>

        {/* Ações do Cabeçalho */}
        <div className="flex items-center gap-2">
          {/* Botão de abrir chat visível no Desktop quando colapsado */}
          {isChatCollapsed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChatCollapsed(false)}
              className="hidden lg:flex text-xs border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-zinc-100 items-center gap-1.5 h-9 rounded-md"
            >
              <Bot className="w-3.5 h-3.5 text-zinc-400" /> Abrir Chat
            </Button>
          )}
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleOpenDebug}
            className="w-9 h-9 rounded-md border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 mr-0.5"
            title="Diagnóstico de Layout"
          >
            <Terminal className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 rounded-md border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={async () => {
              const { logout } = await import("@/lib/auth");
              await logout();
            }}
            className="w-9 h-9 rounded-md border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-red-400"
            title="Terminar sessão"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Barra de Navegação por Abas - Visível Apenas no Celular */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 lg:hidden">
        <button
          onClick={() => handleSetActiveTab("dashboard")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "dashboard"
              ? "border-zinc-500 text-zinc-100 bg-zinc-900/30"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Wallet className="w-3.5 h-3.5" /> Painel
        </button>
        <button
          onClick={() => handleSetActiveTab("metrics")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "metrics"
              ? "border-zinc-500 text-zinc-100 bg-zinc-900/30"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Métricas
        </button>
        <button
          onClick={() => handleSetActiveTab("chat")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "chat"
              ? "border-zinc-500 text-zinc-100 bg-zinc-900/30"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Bot className="w-3.5 h-3.5" /> Conversa IA
        </button>
      </div>

      {/* Main Workspace (Desktop vs Mobile) */}
      <main className="flex-1 flex overflow-hidden relative z-10">
        {/* Vista Móvel: Visível apenas em ecrãs pequenos (< 768px) */}
        <div className="flex h-full w-full md:hidden">
          {activeTab === "dashboard" ? dashboardSection : activeTab === "metrics" ? metricsSection : chatSection}
        </div>

        {/* Vista Desktop: Visível apenas em ecrãs grandes (>= 768px) */}
        <div className="hidden md:flex h-full w-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${isChatCollapsed ? "w-full" : "w-[68%]"}`}>
            {activeTab === "metrics" ? metricsSection : dashboardSection}
          </div>
          {!isChatCollapsed && (
            <div className="h-full w-[32%] border-l border-zinc-800 transition-all duration-300">
              {chatSection}
            </div>
          )}
        </div>
      </main>

      {/* Configurações (Shadcn Dialog) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-50 sm:max-w-lg rounded-md shadow-lg flex flex-col max-h-[85vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 flex-shrink-0">
            <DialogTitle className="font-heading text-sm font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
              <Settings className="w-4 h-4 text-zinc-400" /> Configurações do Kuhula
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Configure as chaves da API do Gemini e faça a gestão dos dados financeiros locais.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-[350px] md:h-[450px] px-6">
            <div className="flex flex-col gap-5 py-4">
              {/* Gemini Config */}
              <div className="flex flex-col gap-2.5">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Conexão IA (Google Gemini)
                </h3>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed -mt-1">
                  Escolhe o provider de IA e o modelo. A chave é guardada localmente no teu dispositivo.
                </p>

                {/* Selector de Provider */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Provider:</label>
                  <Select value={inputProvider} onValueChange={(val) => handleProviderChange(val as ProviderId)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs text-zinc-50 rounded">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50">
                      {AI_PROVIDERS.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.label}
                          {p.models.some(m => m.free) && (
                            <span className="ml-2 text-[9px] text-emerald-400 font-bold">FREE</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Selector de Modelo */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Modelo:</label>
                    <button 
                      onClick={handleFetchModels} 
                      disabled={isFetchingModels || (!inputApiKey && inputProvider !== 'openrouter')} 
                      className="text-[9px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                      title="Carregar modelos disponíveis da API com a chave inserida abaixo"
                    >
                      {isFetchingModels ? <Loader2 className="w-3 h-3 animate-spin" /> : "↻ Carregar da API"}
                    </button>
                  </div>
                  <Select value={inputModel} onValueChange={(val) => val && setInputModel(val)}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs text-zinc-50 rounded">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50 max-h-[300px]">
                      {(dynamicModels[inputProvider] || AI_PROVIDERS.find(p => p.id === inputProvider)?.models || []).map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.label}
                          {m.free && <span className="ml-1 text-[9px] text-emerald-400">grátis</span>}
                          {m.recommended && <span className="ml-1 text-[9px] text-zinc-400">★</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Chave de API */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Chave API ({AI_PROVIDERS.find(p => p.id === inputProvider)?.label}):
                  </label>
                  <div className="relative flex items-center">
                    <Input
                      type={showApiKey ? "text" : "password"}
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      placeholder={AI_PROVIDERS.find(p => p.id === inputProvider)?.keyPlaceholder ?? "API Key..."}
                      className="bg-zinc-900 border-zinc-800 focus-visible:border-zinc-600 rounded pr-10 text-xs text-zinc-50"
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <small className="text-[9px] text-zinc-500">
                    Obtém a chave em{" "}
                    <a
                      href={AI_PROVIDERS.find(p => p.id === inputProvider)?.keyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-300 hover:underline"
                    >
                      {AI_PROVIDERS.find(p => p.id === inputProvider)?.keyUrl}
                    </a>
                  </small>
                </div>
              </div>

              {/* Preferências do Chat */}
              <div className="flex flex-col gap-2.5 border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Preferências do Chat
                </h3>
                <div className="flex items-center justify-between mt-1 p-2.5 bg-zinc-900/40 border border-zinc-800/80 rounded-md">
                  <div className="flex flex-col gap-1 pr-4">
                    <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Enviar mensagem com Enter
                    </label>
                    <span className="text-[9.5px] text-zinc-500 leading-relaxed -mt-0.5">
                      Se desativado, pressionar Enter irá quebrar a linha no telemóvel e computador. Use o botão de envio para submeter.
                    </span>
                  </div>
                  <Checkbox 
                    checked={inputSubmitOnEnter}
                    onCheckedChange={setInputSubmitOnEnter}
                  />
                </div>
              </div>

              {/* Gestão de Dados */}
              <div className="flex flex-col gap-2.5 border-t border-zinc-800 pt-4">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Gestão de Dados Locais
                </h3>
                <p className="text-[10.5px] text-zinc-400 leading-relaxed -mt-1">
                  Importe ou exporte backups do seu estado financeiro ou reinicie os dados locais.
                </p>
                
                <div className="flex flex-wrap gap-2 mt-1">
                  <Button 
                    onClick={handleExportData} 
                    variant="outline" 
                    size="sm" 
                    className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs rounded flex items-center gap-1.5 text-zinc-300 hover:text-zinc-100"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar JSON
                  </Button>

                  <Button 
                    onClick={() => importFileRef.current?.click()} 
                    variant="outline" 
                    size="sm" 
                    className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs rounded flex items-center gap-1.5 text-zinc-300 hover:text-zinc-100"
                  >
                    <Upload className="w-3.5 h-3.5" /> Importar JSON
                  </Button>
                  <input 
                    type="file" 
                    ref={importFileRef} 
                    onChange={handleImportData} 
                    accept=".json" 
                    className="hidden" 
                  />

                  <Button 
                    onClick={handleClearChatHistory}
                    variant="outline"
                    size="sm"
                    className="bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-xs rounded flex items-center gap-1.5 text-zinc-300 hover:text-zinc-100"
                  >
                    Limpar Chat
                  </Button>

                  <Button 
                    onClick={handleClearAllData} 
                    variant="destructive" 
                    size="sm" 
                    className="text-xs rounded flex items-center gap-1.5 bg-red-950/20 hover:bg-red-900 border border-red-900 text-red-400 hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Apagar Tudo
                  </Button>
                </div>
              </div>

            </div>
          </ScrollArea>

          <DialogFooter className="mx-0 mb-0 mt-0 border-t border-zinc-800 bg-zinc-900/30 px-6 py-4 flex-shrink-0" style={{ display: "flex", flexDirection: "row", justifyContent: "flex-end", gap: "0.5rem", alignItems: "center" }}>
            <Button onClick={() => setIsSettingsOpen(false)} variant="ghost" className="text-xs text-zinc-400 hover:bg-zinc-800" disabled={isSavingSettings}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded flex items-center justify-center gap-1.5" disabled={isSavingSettings}>
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  A guardar...
                </>
              ) : (
                "Salvar Configurações"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adicionar Nova Conta (Shadcn Dialog) */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-50 sm:max-w-md rounded-md shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
              <Plus className="w-4 h-4 text-zinc-400" /> Nova Conta / Carteira
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Adicione uma nova conta bancária ou carteira móvel para gerir o seu saldo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Nome da Conta / Carteira:</label>
              <Input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="Ex: M-Pesa, BCI, e-Mola, Standard Bank..."
                className="bg-zinc-900 border-zinc-800 focus-visible:border-zinc-600 rounded text-xs text-zinc-50"
              />
              <small className="text-[9.5px] text-zinc-500">
                Nomes contendo &quot;M-Pesa&quot;, &quot;e-Mola&quot; ou &quot;carteira&quot; são categorizados como Carteiras Móveis; outros são categorizados como Bancos.
              </small>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Saldo Inicial (MT):</label>
              <Input
                type="number"
                value={newAccountBalance}
                onChange={(e) => setNewAccountBalance(e.target.value)}
                placeholder="0.00"
                className="bg-zinc-900 border-zinc-800 focus-visible:border-zinc-600 rounded text-xs text-zinc-50"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-zinc-800 pt-4 flex gap-2">
            <Button onClick={() => setIsAddAccountOpen(false)} variant="ghost" className="text-xs text-zinc-400 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button onClick={handleCreateAccount} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded">
              Adicionar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diagnóstico de Layout (Shadcn Dialog) */}
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="bg-zinc-950 border border-zinc-800 text-zinc-50 sm:max-w-lg rounded-md shadow-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-wider">
              <Terminal className="w-4 h-4 text-zinc-400" /> Diagnóstico do Sistema
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Logs de erros e informações técnicas de layout.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            {/* Abas */}
            <div className="flex gap-1 bg-zinc-900 rounded p-1">
              <button
                className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors ${isDebugView === "layout" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                onClick={() => setIsDebugView("layout")}
              >
                Layout
              </button>
              <button
                className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors flex items-center justify-center gap-1.5 ${isDebugView === "errors" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                onClick={() => setIsDebugView("errors")}
              >
                Erros
                {errorLogs.length > 0 && (
                  <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">{errorLogs.length}</span>
                )}
              </button>
              <button
                className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors flex items-center justify-center gap-1.5 ${isDebugView === "health" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                onClick={runHealthCheck}
              >
                Health Check
                {healthCheck.length > 0 && healthCheck.some(h => h.status === "error") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                )}
                {healthCheck.length > 0 && !healthCheck.some(h => h.status === "error") && healthCheck.every(h => h.status === "ok") && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                )}
              </button>
              <button
                className={`flex-1 text-[10px] font-semibold py-1 rounded transition-colors ${isDebugView === "runtime" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}
                onClick={() => setIsDebugView("runtime")}
              >
                Runtime
              </button>
            </div>

            {isDebugView === "layout" && (
              <>
                <Textarea
                  value={debugInfo}
                  readOnly
                  className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono text-[10.5px] leading-relaxed h-[280px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded resize-none"
                />
                <p className="text-[10px] text-zinc-500">
                  *Estes detalhes incluem dados puramente visuais e técnicos sobre o ecrã e as dimensões do contentor, sem qualquer dado bancário sensível.*
                </p>
              </>
            )}

            {isDebugView === "errors" && (
              <div className="flex flex-col gap-2 h-[280px] overflow-y-auto">
                {errorLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                    <Terminal className="w-8 h-8" />
                    <p className="text-xs">Nenhum erro registado nesta sessão.</p>
                  </div>
                ) : (
                  [...errorLogs].reverse().map((log, i) => (
                    <div key={i} className="bg-zinc-900 border border-red-900/40 rounded p-2.5 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">Erro</span>
                        <span className="text-[9px] text-zinc-500">{log.timestamp}</span>
                      </div>
                      <div className="flex gap-2 text-[9px] text-zinc-400">
                        <span>Provider: <span className="text-zinc-200">{log.provider}</span></span>
                        <span>·</span>
                        <span>Modelo: <span className="text-zinc-200">{log.model}</span></span>
                      </div>
                      <p className="text-[10px] text-zinc-300 font-mono break-all leading-relaxed mt-0.5">{log.message}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {isDebugView === "health" && (
              <div className="flex flex-col gap-2 h-[280px] overflow-y-auto">
                {healthCheck.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                    <p className="text-xs">Clica em Health Check para iniciar.</p>
                  </div>
                ) : (
                  <>
                    {healthCheck.map((item, i) => (
                      <div key={i} className={`bg-zinc-900 rounded p-2.5 flex items-start gap-2.5 border ${
                        item.status === "ok" ? "border-emerald-900/40" :
                        item.status === "error" ? "border-red-900/40" :
                        item.status === "warning" ? "border-yellow-900/40" :
                        "border-zinc-800"
                      }`}>
                        <div className="mt-0.5 shrink-0">
                          {item.status === "loading" && (
                            <div className="w-3 h-3 rounded-full border-2 border-zinc-600 border-t-zinc-300 animate-spin" />
                          )}
                          {item.status === "ok" && <div className="w-3 h-3 rounded-full bg-emerald-500" />}
                          {item.status === "error" && <div className="w-3 h-3 rounded-full bg-red-500" />}
                          {item.status === "warning" && <div className="w-3 h-3 rounded-full bg-yellow-500" />}
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-[10px] font-semibold text-zinc-200">{item.label}</span>
                          <span className={`text-[9px] font-mono break-all ${
                            item.status === "ok" ? "text-emerald-400" :
                            item.status === "error" ? "text-red-400" :
                            item.status === "warning" ? "text-yellow-400" :
                            "text-zinc-500"
                          }`}>{item.detail}</span>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={runHealthCheck}
                      className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors text-center py-1"
                    >
                      ↻ Repetir verificação
                    </button>
                  </>
                )}
              </div>
            )}
            {isDebugView === "runtime" && (
              <RuntimeLogsPanel />
            )}
          </div>

          <DialogFooter className="border-t border-zinc-800 pt-4 flex sm:justify-between items-center w-full gap-2">
            <div className="text-[11px] text-zinc-400">
              {isCopied && <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3.5 h-3.5" /> Copiado!</span>}
              {errorLogs.length > 0 && isDebugView === "errors" && (
                <button onClick={() => setErrorLogs([])} className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors">
                  Limpar logs
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {isDebugView !== "health" && isDebugView !== "runtime" && (
                <Button onClick={handleCopyDebug} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded flex items-center gap-1.5">
                  {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? "Copiado!" : "Copiar"}
                </Button>
              )}
              {isDebugView === "runtime" && (
                <Button
                  onClick={() => { import("@/lib/logger").then(m => m.log.copyToClipboard()); }}
                  className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar logs
                </Button>
              )}
              <Button onClick={() => setIsDebugOpen(false)} variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-xs text-zinc-400">
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
