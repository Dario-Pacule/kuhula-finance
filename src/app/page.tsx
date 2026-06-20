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
  Filter
} from "lucide-react";

import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
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
import { AppState, Goal, ChatMessage } from "@/types";

const DEFAULT_STATE: AppState = {
  accounts: {
    "M-Pesa": 4500.00,
    "BCI": 32000.00,
    "e-Mola": 1200.00
  },
  transactions: [
    {
      id: "tx-1",
      description: "Recarga Credelec",
      amount: 1000.00,
      type: "expense",
      category: "Energia",
      account: "M-Pesa",
      date: "2026-06-01",
      isRecurring: true,
      dayOfMonth: 1
    },
    {
      id: "tx-2",
      description: "Supermercado Recheio",
      amount: 3200.00,
      type: "expense",
      category: "Alimentação",
      account: "BCI",
      date: "2026-06-02",
      isRecurring: false
    },
    {
      id: "tx-3",
      description: "Salário Base",
      amount: 45000.00,
      type: "income",
      category: "Salário",
      account: "BCI",
      date: "2026-06-03",
      isRecurring: true,
      dayOfMonth: 3
    },
    {
      id: "tx-4",
      description: "Corrida de Txopela",
      amount: 150.00,
      type: "expense",
      category: "Transporte",
      account: "M-Pesa",
      date: "2026-06-04",
      isRecurring: false
    }
  ],
  goals: [
    {
      title: "Reserva de Emergência",
      targetAmount: 50000.00,
      currentAmount: 15000.00,
      deadline: "2026-12-31"
    },
    {
      title: "Seguro de Carro",
      targetAmount: 12000.00,
      currentAmount: 2000.00,
      deadline: "2026-11-30"
    }
  ],
  budgetLimits: {
    "Alimentação": 10000.00,
    "Lazer": 5000.00
  },
  strategies: [
    {
      id: "strat-1",
      title: "Reserva de Emergência Ativa",
      description: "Excelente! Começou a poupar para a sua Reserva de Emergência. Para acelerar esta meta, tente reduzir 10% dos seus gastos em Lazer.",
      type: "success"
    }
  ]
};

const SUGGESTIONS = [
  "Tenho 50.000 MT na conta do BCI e 8.000 MT no M-Pesa",
  "Recebi o meu salário de 45.000 MT na conta bancária",
  "Paguei 1.200 MT de energia Credelec com M-Pesa",
  "Ajuda-me a planear o seguro do carro que custa 18.000 MT em Dezembro"
];

export default function Home() {
  // Estado Financeiro
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  
  // Estado Gemini API e Configurações
  const [clientApiKey, setClientApiKey] = useState<string>("");
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [model, setModel] = useState<string>("gemini-2.5-flash");
  
  // Diálogos e UI
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [inputApiKey, setInputApiKey] = useState<string>("");
  const [inputModel, setInputModel] = useState<string>("gemini-2.5-flash");
  const [submitOnEnter, setSubmitOnEnter] = useState<boolean>(true);
  const [inputSubmitOnEnter, setInputSubmitOnEnter] = useState<boolean>(true);
  
  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(false);
  
  // Responsividade Móvel
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat">("dashboard");

  // Depuração de Layout
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
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
  
  // Referências
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Inicialização (Client-side)
  useEffect(() => {
    // Carregar dados locais de imediato (fallback rápido)
    const savedState = localStorage.getItem("kuhula_state_next");
    if (savedState) {
      try {
        setState(JSON.parse(savedState));
      } catch (e) {
        console.error("Erro ao ler estado do localStorage", e);
      }
    }

    // Tentar carregar da base de dados remota
    const fetchRemoteState = async () => {
      try {
        const res = await fetch("/api/state");
        if (res.status === 200) {
          const data = await res.json();
          if (data.state) {
            setState(data.state);
            localStorage.setItem("kuhula_state_next", JSON.stringify(data.state));
          }
        }
      } catch (err) {
        console.warn("Base de dados remota indisponível, usando localStorage como fallback.", err);
      }
    };
    fetchRemoteState();

    const savedKey = localStorage.getItem("kuhula_gemini_key_next") || "";
    setClientApiKey(savedKey);
    setInputApiKey(savedKey);

    const savedModel = localStorage.getItem("kuhula_gemini_model_next") || "gemini-2.5-flash";
    setModel(savedModel);
    setInputModel(savedModel);

    const savedSubmit = localStorage.getItem("kuhula_submit_on_enter_next");
    const parsedSubmit = savedSubmit !== null ? savedSubmit === "true" : true;
    setSubmitOnEnter(parsedSubmit);
    setInputSubmitOnEnter(parsedSubmit);

    const savedHistory = localStorage.getItem("kuhula_chat_history_next");
    if (savedHistory) {
      try {
        setMessages(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Erro ao ler histórico de chat", e);
      }
    }

    // Detector de tamanho de tela para responsividade móvel
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
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

  // Persistir Estado Financeiro
  const saveState = async (newState: AppState) => {
    // Salvar localmente para rapidez e fallback offline
    setState(newState);
    localStorage.setItem("kuhula_state_next", JSON.stringify(newState));

    // Salvar na base de dados remota em segundo plano
    try {
      await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ state: newState })
      });
    } catch (err) {
      console.warn("Falha ao salvar na base de dados remota.", err);
    }
  };

  // Persistir Histórico de Chat
  const saveChatHistory = (newHistory: ChatMessage[]) => {
    setMessages(newHistory);
    localStorage.setItem("kuhula_chat_history_next", JSON.stringify(newHistory));
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

  const handleCopyDebug = () => {
    if (typeof navigator === "undefined") return;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(debugInfo)
        .then(() => {
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Falha ao copiar com navigator.clipboard, usando fallback", err);
          fallbackCopyText(debugInfo);
        });
    } else {
      fallbackCopyText(debugInfo);
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

  // Configurar Chaves de API
  const handleSaveSettings = () => {
    setClientApiKey(inputApiKey);
    setModel(inputModel);
    setSubmitOnEnter(inputSubmitOnEnter);
    localStorage.setItem("kuhula_gemini_key_next", inputApiKey);
    localStorage.setItem("kuhula_gemini_model_next", inputModel);
    localStorage.setItem("kuhula_submit_on_enter_next", inputSubmitOnEnter ? "true" : "false");
    setIsSettingsOpen(false);
    addSystemLog("Configurações atualizadas!");
  };

  // Limpar Todos os Dados
  const handleClearAllData = () => {
    if (confirm("ATENÇÃO: Isso apagará todas as suas transações, contas e metas financeiras permanentemente. Deseja prosseguir?")) {
      const reset = { accounts: {}, transactions: [], goals: [], budgetLimits: {} };
      saveState(reset);
      saveChatHistory([]);
      setIsSettingsOpen(false);
      addSystemLog("Todos os dados locais foram reiniciados.");
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

  // Adicionar Log do Sistema
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

    // Adiciona bolha de usuário na UI
    const formattedUserMsgText = `[CONTEXTO_FINANCEIRO_ATUAL]
--- MENSAGEM DO USUÁRIO ---
${text}`;

    const newHistory: ChatMessage[] = [
      ...messages,
      { role: "user", parts: [{ text: formattedUserMsgText }] }
    ];

    // Atualiza chat UI
    setMessages(prev => [
      ...prev,
      { role: "user", parts: [{ text }] } // Mostra o texto limpo para o usuário
    ]);
    
    setInputValue("");

    if (!clientApiKey) {
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { role: "model", parts: [{ text: "Por favor, configure a sua **Chave de API do Gemini** clicando no ícone de configurações ⚙️ acima para que eu possa ajudá-lo." }] }
        ]);
      }, 600);
      return;
    }

    setIsTyping(true);

    try {
      const response = await callChatAPI(newHistory, state);
      setIsTyping(false);

      if (response.error) {
        throw new Error(response.error.message);
      }

      await handleGeminiResponse(response, newHistory, state);
    } catch (err: any) {
      setIsTyping(false);
      setMessages(prev => [
        ...prev,
        { role: "model", parts: [{ text: `Ocorreu um erro: ${err.message || err}. Verifique as configurações.` }] }
      ]);
    }
  };

  // Chamar Rota de API
  const callChatAPI = async (history: ChatMessage[], currentState: AppState) => {
    const systemInstruction = `Você é o Kuhula AI, um assistente e conselheiro financeiro pessoal empático, objetivo e pragmático de Moçambique.
Sua prioridade absoluta é compreender a vida financeira do usuário e ajudá-lo a organizar suas finanças de forma gradual e consciente, indo direto ao ponto.

DIRETRIZES DE COMPORTAMENTO:
1. OBJETIVIDADE E PRAGMATISMO: Seja curto, direto e prático em suas respostas. Evite textos longos, explicações longas ou rodeios. Vá direto ao ponto, sugerindo soluções concretas. Limite suas mensagens a no máximo 2 ou 3 parágrafos curtos ou poucos tópicos claros.
2. DIÁLOGO E EMPATIA: Ouça o usuário. Demonstre interesse genuíno pelas suas dificuldades (como dívidas, falta de dinheiro para Credelec, custos de transporte/chapa), mas de forma breve.
3. USO MODERADO DAS FERRAMENTAS: Não chame ferramentas (Function Calling) por impulso a cada menção a um valor. Primeiro, converse de forma direta, valide a situação e sugira ações. Só use as ferramentas de transação, saldo, estratégia ou meta após uma conclusão natural da conversa ou quando o usuário aceitar ou pedir explicitamente para lançar a informação no painel.
4. CONSELHOS PERSONALIZADOS: Apresente as metodologias financeiras como opções amigáveis e debata com o usuário qual se adapta melhor ao seu estilo de vida antes de aplicá-la.

METODOLOGIAS FINANCEIRAS:
Você conhece metodologias de finanças populares (como a Regra 50/30/20, o Método dos Envelopes, Pague-se a Si Próprio Primeiro, Bola de Neve para dívidas).
Se o usuário concordar em adotar um método no chat ou pedir conselhos:
1. Recomende o método no chat de forma simples, concisa e pragmática.
2. Aplique-o VISUALMENTE no painel do usuário usando as ferramentas quando acordado:
   - Use 'createOrUpdateStrategy' para criar cartões explicando a estratégia adotada (ex: um cartão 'Regra 50/30/20: Plano de Ação').
   - Use 'setBudgetLimit' para configurar limites de orçamento alinhados com o método (ex: 30% do rendimento mensal para Lazer).
   - Use 'adjustAccountBalance' para criar 'envelopes' virtuais se o usuário adotar o Método dos Envelopes (ex: criar conta 'Envelope Alimentação').
   - Use 'createOrUpdateGoal' para configurar as poupanças recomendadas.

DETALHES DE MOÇAMBIQUE:
- Moeda: Metical Moçambicano (símbolo: MT, ISO: MZN). Formate sempre como '1.000 MT'.
- Carteiras Móveis: M-Pesa, e-Mola, mKesh.
- Bancos: BCI, Millennium Bim, Standard Bank, Absa, FNB, Moza Banco.
- Custos do dia-a-dia: Credelec, FIPAG, TV Cabo, Chapas/Txopelas.

ESTADO FINANCEIRO ATUAL DO USUÁRIO EM TEMPO REAL:
${JSON.stringify({
    accounts: currentState.accounts,
    goals: currentState.goals,
    budgetLimits: currentState.budgetLimits,
    strategies: currentState.strategies || [],
    recentTransactions: currentState.transactions.slice(-12)
}, null, 2)}

Mantenha as suas respostas amigáveis, empáticas, curtas, objetivas, pragmáticas e em português de Moçambique.`;

    // Filtrar histórico para enviar apenas mensagens com papéis válidos para a API do Gemini (user e model)
    const validHistory = history.filter(msg => msg.role === "user" || msg.role === "model");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        history: validHistory,
        systemInstruction,
        model,
        clientApiKey
      })
    });

    return await res.json();
  };

  // Processar resposta do Gemini
  const handleGeminiResponse = async (geminiData: any, currentHistory: ChatMessage[], currentState: AppState) => {
    if (geminiData.candidates && geminiData.candidates[0].content && geminiData.candidates[0].content.parts) {
      const parts = geminiData.candidates[0].content.parts;
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textPart = parts.find((p: any) => p.text);

      if (functionCalls.length > 0) {
        // IA acionou chamadas de função
        const modelCallMsg = geminiData.candidates[0].content;
        const updatedHistory = [...currentHistory, modelCallMsg];

        const toolResponseParts = [];
        let stateToMutate = { ...currentState };

        for (const fc of functionCalls) {
          const name = fc.functionCall.name;
          const args = fc.functionCall.args;

          addSystemLog(`IA executou a ferramenta: **${name}**`);
          
          // Modificar o estado local conforme a ferramenta
          const executionResult = executeToolAction(name, args, stateToMutate);
          stateToMutate = executionResult.newState;

          toolResponseParts.push({
            functionResponse: {
              name,
              response: executionResult.result
            }
          });
        }

        // Atualizar estado React e salvar no localStorage
        saveState(stateToMutate);

        // Adicionar resposta das ferramentas ao histórico
        const toolContentMsg: ChatMessage = {
          role: "user",
          parts: toolResponseParts
        };
        const finalHistory = [...updatedHistory, toolContentMsg];

        // Segunda chamada para gerar resposta de texto conversacional
        setIsTyping(true);
        const secondRes = await callChatAPI(finalHistory, stateToMutate);
        setIsTyping(false);

        if (secondRes.candidates && secondRes.candidates[0].content && secondRes.candidates[0].content.parts) {
          const finalModelMsg = secondRes.candidates[0].content;
          const finalResponseText = finalModelMsg.parts[0].text;
          
          setMessages(prev => [...prev, { role: "model", parts: [{ text: finalResponseText }] }]);
          saveChatHistory([...finalHistory, finalModelMsg]);
        }
      } else if (textPart) {
        // Apenas texto conversacional
        const modelMsg = geminiData.candidates[0].content;
        setMessages(prev => [...prev, modelMsg]);
        saveChatHistory([...currentHistory, modelMsg]);
      }
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
          } else {
            stateCopy.accounts[args.account] -= args.amount;
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
            actionLabel: args.actionLabel
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
                      <h4 className="text-xs font-bold text-zinc-100 flex items-center justify-between">
                        {strat.title}
                        <span className={`w-1.5 h-1.5 rounded-full ${
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

      {/* Card do Gráfico de Previsões */}
      <Card className="bg-zinc-900 border-zinc-800 rounded-lg shadow-sm">
        <CardHeader className="pb-1 pt-4">
          <CardTitle className="font-heading text-xs font-semibold flex items-center gap-2 text-zinc-100 uppercase tracking-wider">
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" /> Previsibilidade de Caixa (Próximos 180 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[190px] pt-2 pr-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
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

  // --- SEÇÃO DO ASSISTENTE DE CHAT (PARA DESKTOP E MÓVEL) ---
  const chatSection = (
    <section id="chat-container" className="w-full h-full bg-zinc-950/20 flex flex-col relative overflow-hidden">
      {/* Cabeçalho do Chat */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800 bg-zinc-950">
        {/* Esquerda: Ícone e Kuhula AI */}
        <div className="flex items-center gap-2">
          <Bot className="w-4.5 h-4.5 text-zinc-100" />
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
            {messages.filter(m => m.role === "user" || m.role === "model").map((msg, i) => {
              const isModel = msg.role === "model";
              let text = msg.parts?.[0]?.text || "";
              
              if (!isModel && text && text.includes("CONTEXTO_FINANCEIRO_ATUAL")) {
                const parts = text.split("--- MENSAGEM DO USUÁRIO ---");
                text = parts[1] ? parts[1].trim() : text;
              }

              const formattedHtml = text
                .replace(/\n\n/g, "<br/><br/>")
                .replace(/\n/g, "<br/>")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>");

              return (
                <div 
                  key={i} 
                  className={`max-w-[85%] p-3.5 rounded-lg text-[12px] leading-relaxed ${
                    isModel 
                      ? "self-start bg-zinc-900 border border-zinc-800 text-zinc-100" 
                      : "self-end bg-zinc-100 text-zinc-950 shadow-sm font-medium"
                  }`}
                >
                  <div 
                    dangerouslySetInnerHTML={{ __html: formattedHtml }} 
                    className="message-content"
                  />
                </div>
              );
            })}

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

      {/* Chips de Sugestão */}
      <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-950 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        {SUGGESTIONS.map((text, idx) => (
          <button 
            key={idx}
            onClick={() => handleSendMessage(text)}
            className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[10px] text-zinc-400 hover:text-zinc-100 rounded-md transition-all"
          >
            &quot;{text.length > 30 ? text.substring(0, 30) + "..." : text}&quot;
          </button>
        ))}
      </div>

      {/* Caixa de Entrada */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950/40 flex items-center gap-3">
        <div className="flex-1 flex items-center bg-zinc-900 border border-zinc-800 rounded-md px-3 py-1 focus-within:ring-1 focus-within:ring-zinc-400 focus-within:border-zinc-400 transition-all">
          <Textarea 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (submitOnEnter) {
                  e.preventDefault();
                  handleSendMessage(inputValue);
                }
              }
            }}
            placeholder="Introduza os seus gastos ou peça conselhos..." 
            className="bg-transparent border-0 resize-none text-[11.5px] focus-visible:ring-0 focus-visible:ring-offset-0 px-0 py-1 flex-1 text-zinc-100 placeholder-zinc-500 min-h-[26px] max-h-[70px]"
            rows={1}
          />
          <Button 
            onClick={() => handleSendMessage(inputValue)}
            size="icon" 
            className="w-7 h-7 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-900 ml-2 flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );

  return (
    <div id="main-layout-root" className="flex flex-col h-dvh w-full bg-zinc-950 text-zinc-50 overflow-hidden font-sans">
      {/* Cabeçalho Principal */}
      <header id="main-header" className="relative flex items-center justify-between h-[70px] px-6 bg-zinc-950 border-b border-zinc-800 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-zinc-50 text-zinc-950 shadow-sm">
            <Sprout className="w-4.5 h-4.5" />
          </div>
          <div>
            <h1 className="font-heading text-sm font-bold tracking-tight text-zinc-100">
              Kuhula Finance
            </h1>
            <span className="text-[9px] text-zinc-400 block -mt-1 font-semibold tracking-wider">
              NEXTJS + SHADCN UI • MOÇAMBIQUE
            </span>
          </div>
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
        </div>
      </header>

      {/* Barra de Navegação por Abas - Visível Apenas no Celular */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 lg:hidden">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 border-b-2 transition-all ${
            activeTab === "dashboard"
              ? "border-zinc-500 text-zinc-100 bg-zinc-900/30"
              : "border-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Wallet className="w-3.5 h-3.5" /> Painel
        </button>
        <button
          onClick={() => setActiveTab("chat")}
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
        {/* Vista Móvel: Visível apenas em ecrãs pequenos (< 1024px) */}
        <div className="flex h-full w-full lg:hidden">
          {activeTab === "dashboard" ? dashboardSection : chatSection}
        </div>

        {/* Vista Desktop: Visível apenas em ecrãs grandes (>= 1024px) */}
        <div className="hidden lg:flex h-full w-full overflow-hidden">
          <div className={`h-full transition-all duration-300 ${isChatCollapsed ? "w-full" : "w-[68%]"}`}>
            {dashboardSection}
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
                  A IA é executada localmente através da API oficial. Os seus dados permanecem armazenados de forma privada no seu navegador.
                </p>
                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Chave API do Gemini:</label>
                  <div className="relative flex items-center">
                    <Input 
                      type={showApiKey ? "text" : "password"}
                      value={inputApiKey}
                      onChange={(e) => setInputApiKey(e.target.value)}
                      placeholder="Introduza a sua AI_KEY..."
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
                    Obtenha uma chave grátis no <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:underline">Google AI Studio</a>.
                  </small>
                </div>

                <div className="flex flex-col gap-1.5 mt-1">
                  <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Modelo:</label>
                  <Select value={inputModel} onValueChange={(val) => setInputModel(val || "gemini-2.5-flash")}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs text-zinc-50 rounded">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border border-zinc-800 text-zinc-50">
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado - Rápido)</SelectItem>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash</SelectItem>
                      <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                    </SelectContent>
                  </Select>
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
            <Button onClick={() => setIsSettingsOpen(false)} variant="ghost" className="text-xs text-zinc-400 hover:bg-zinc-800">
              Cancelar
            </Button>
            <Button onClick={handleSaveSettings} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded">
              Salvar Configurações
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
              <Terminal className="w-4 h-4 text-zinc-400" /> Diagnóstico de Layout
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs">
              Copie os detalhes abaixo e envie-os no chat para nos ajudar a depurar o seu layout e responsividade.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Textarea
              value={debugInfo}
              readOnly
              className="bg-zinc-900 border-zinc-800 text-zinc-300 font-mono text-[10.5px] leading-relaxed h-[300px] focus-visible:ring-0 focus-visible:ring-offset-0 rounded resize-none"
            />
            <p className="text-[10px] text-zinc-500">
              *Estes detalhes incluem dados puramente visuais e técnicos sobre o ecrã e as dimensões do contentor, sem qualquer dado bancário sensível.*
            </p>
          </div>

          <DialogFooter className="border-t border-zinc-800 pt-4 flex sm:justify-between items-center w-full gap-2">
            <div className="text-[11px] text-zinc-400">
              {isCopied && <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3.5 h-3.5" /> Copiado com sucesso!</span>}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopyDebug} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-semibold rounded flex items-center gap-1.5">
                {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {isCopied ? "Copiado!" : "Copiar Informações"}
              </Button>
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
