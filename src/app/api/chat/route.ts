/**
 * POST /api/chat
 *
 * Arquitectura: o ciclo completo de tool calling é resolvido no backend.
 * O frontend envia histórico e recebe resposta final limpa.
 *
 * Ciclo Gemini:
 *   1. Envia history → Gemini devolve functionCall(s)
 *   2. Backend executa as tools (retorna resultado simulado)
 *   3. Envia functionResponse → Gemini devolve texto final
 *   4. Repete até max 5 ciclos (evita loops infinitos)
 *
 * Resposta normalizada:
 * {
 *   text: string,
 *   toolCallsMade: Array<{ name: string, args: any, result: any }>,
 *   askUserInput?: { question: string, inputType, options?, slider* },
 *   usage: { promptTokens: number, completionTokens: number }
 * }
 */

import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, any> };
  functionResponse?: { name: string; response: any };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface ToolCallMade {
  name: string;
  args: Record<string, any>;
  result: any;
}

interface NormalizedResponse {
  text?: string;
  toolCallsMade: ToolCallMade[];
  askUserInput?: Record<string, any>;
  usage: { promptTokens: number; completionTokens: number };
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// DEFINIÇÕES DAS TOOLS
// Schema Gemini nativo — sem conversões
// ─────────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: "addTransaction",
    description: "Adiciona uma nova transacção financeira (despesa ou receita) ao painel.",
    parameters: {
      type: "OBJECT",
      properties: {
        amount:      { type: "NUMBER",  description: "Valor em Meticais (MT)." },
        type:        { type: "STRING",  enum: ["income", "expense"] },
        category:    { type: "STRING",  description: "Ex: Alimentação, Transporte, Salário." },
        account:     { type: "STRING",  description: "Ex: M-Pesa, BCI, e-Mola." },
        description: { type: "STRING",  description: "Descrição breve." },
        isRecurring: { type: "BOOLEAN" },
        dayOfMonth:  { type: "INTEGER", description: "Dia do mês se recorrente (1-31)." },
      },
      required: ["amount", "type", "category", "account", "description"],
    },
  },
  {
    name: "deleteTransaction",
    description: "Remove uma transacção pelo ID.",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING" } },
      required: ["id"],
    },
  },
  {
    name: "createOrUpdateGoal",
    description: "Cria ou actualiza uma meta de poupança.",
    parameters: {
      type: "OBJECT",
      properties: {
        title:         { type: "STRING" },
        targetAmount:  { type: "NUMBER" },
        currentAmount: { type: "NUMBER" },
        deadline:      { type: "STRING", description: "AAAA-MM-DD" },
      },
      required: ["title", "targetAmount"],
    },
  },
  {
    name: "deleteGoal",
    description: "Remove uma meta de poupança.",
    parameters: {
      type: "OBJECT",
      properties: { title: { type: "STRING" } },
      required: ["title"],
    },
  },
  {
    name: "adjustAccountBalance",
    description: "Cria ou ajusta o saldo de uma conta ou carteira.",
    parameters: {
      type: "OBJECT",
      properties: {
        accountName: { type: "STRING" },
        balance:     { type: "NUMBER" },
      },
      required: ["accountName", "balance"],
    },
  },
  {
    name: "deleteAccount",
    description: "Remove uma conta ou carteira.",
    parameters: {
      type: "OBJECT",
      properties: { accountName: { type: "STRING" } },
      required: ["accountName"],
    },
  },
  {
    name: "setBudgetLimit",
    description: "Define limite mensal para uma categoria de despesa.",
    parameters: {
      type: "OBJECT",
      properties: {
        category:    { type: "STRING" },
        limitAmount: { type: "NUMBER" },
      },
      required: ["category", "limitAmount"],
    },
  },
  {
    name: "createOrUpdateStrategy",
    description: "Cria ou actualiza um cartão de estratégia/conselho no painel.",
    parameters: {
      type: "OBJECT",
      properties: {
        id:          { type: "STRING" },
        title:       { type: "STRING" },
        description: { type: "STRING" },
        type:        { type: "STRING", enum: ["info", "warning", "success", "critical"] },
        actionLabel: { type: "STRING" },
        frequency:   { type: "STRING", enum: ["daily", "weekly", "monthly", "one-time"] },
      },
      required: ["id", "title", "description", "type"],
    },
  },
  {
    name: "deleteStrategy",
    description: "Remove um cartão de estratégia.",
    parameters: {
      type: "OBJECT",
      properties: { id: { type: "STRING" } },
      required: ["id"],
    },
  },
  {
    name: "askUserInput",
    description: `Apresenta ao utilizador uma pergunta interactiva com opções clicáveis.
Usa APENAS quando há opções predefinidas claras e limitadas.
Exemplos correctos: escolher conta (M-Pesa|BCI), confirmar registo (Sim/Não), escolher categorias.
NUNCA usar para perguntas abertas — essas ficam como texto normal.`,
    parameters: {
      type: "OBJECT",
      properties: {
        question:  { type: "STRING", description: "A pergunta a mostrar ao utilizador." },
        inputType: { type: "STRING", enum: ["single", "multiple", "confirm", "slider"] },
        options:   { type: "STRING", description: "Opções separadas por | (ex: M-Pesa|BCI). Não usar em confirm/slider." },
        sliderMin:  { type: "NUMBER" },
        sliderMax:  { type: "NUMBER" },
        sliderStep: { type: "NUMBER" },
        sliderUnit: { type: "STRING" },
      },
      required: ["question", "inputType"],
    },
  },
  {
    name: "updateUserProfile",
    description: `Actualiza o perfil persistente do utilizador com factos aprendidos na conversa.
Usa silenciosamente sempre que o utilizador revelar: nome, profissão, rendimento, dependentes, objectivos, padrões de comportamento.
Não perguntes ao utilizador antes de usar — é uma acção transparente de background.`,
    parameters: {
      type: "OBJECT",
      properties: {
        name:                   { type: "STRING" },
        occupation:             { type: "STRING" },
        monthlyIncome:          { type: "NUMBER" },
        incomeDay:              { type: "INTEGER" },
        familySize:             { type: "INTEGER" },
        primaryAccounts:        { type: "STRING" },
        financialGoalNarrative: { type: "STRING" },
        behaviorNotes:          { type: "STRING" },
      },
      required: [],
    },
  },
  {
    name: "requestContext",
    description: `Pede dados financeiros específicos quando precisas de mais informação.
Usa quando o contexto actual não tem os dados suficientes para responder com precisão.
Exemplos:
- Transacções de um mês específico → {dataType:"transactions", month:"2026-05"}
- Histórico de uma conta → {dataType:"account_history", account:"BCI"}
- Todas as metas detalhadas → {dataType:"goals"}
Não uses para dados que já estão no contexto.`,
    parameters: {
      type: "OBJECT",
      properties: {
        dataType: {
          type: "STRING",
          enum: ["transactions", "goals", "budget_limits", "account_history", "strategies", "all"],
        },
        month:   { type: "STRING",  description: "AAAA-MM para filtrar transacções." },
        account: { type: "STRING",  description: "Nome da conta para account_history." },
        limit:   { type: "INTEGER", description: "Máx. de registos (default 20)." },
      },
      required: ["dataType"],
    },
  },
];

const GEMINI_TOOLS = [{ functionDeclarations: TOOL_DECLARATIONS }];

// Tools que alteram estado financeiro (precisam de confirmação no frontend)
const FINANCIAL_TOOLS = new Set([
  "addTransaction", "deleteTransaction", "createOrUpdateGoal",
  "deleteGoal", "adjustAccountBalance", "deleteAccount",
  "setBudgetLimit", "createOrUpdateStrategy", "deleteStrategy",
]);

// ─────────────────────────────────────────────────────────────
// CONTEXT RESOLVER — para a tool requestContext
// ─────────────────────────────────────────────────────────────

function resolveContextRequest(args: any, context: any): any {
  if (!context) return { error: "Sem contexto disponível" };

  const { dataType, month, account, limit = 20 } = args;
  const { transactions = [], goals = [], budgetLimits = {}, strategies = [] } = context;

  switch (dataType) {
    case "transactions": {
      let txs = transactions;
      if (month) txs = txs.filter((t: any) => t.date?.startsWith(month));
      return txs.slice(-limit).map((t: any) => ({
        date: t.date, type: t.type, amount: t.amount,
        description: t.description, category: t.category, account: t.account,
      }));
    }
    case "account_history": {
      let txs = transactions;
      if (account) txs = txs.filter((t: any) => t.account === account);
      return txs.slice(-limit).map((t: any) => ({
        date: t.date, type: t.type, amount: t.amount, description: t.description,
      }));
    }
    case "goals":
      return goals;
    case "budget_limits":
      return budgetLimits;
    case "strategies":
      return strategies;
    case "all":
      return { transactions: transactions.slice(-limit), goals, budgetLimits, strategies };
    default:
      return { error: `dataType desconhecido: ${dataType}` };
  }
}

// ─────────────────────────────────────────────────────────────
// GEMINI — CICLO COMPLETO COM TOOL CALLING
// ─────────────────────────────────────────────────────────────

async function runGeminiCycle(
  history: GeminiContent[],
  systemInstruction: string,
  model: string,
  apiKey: string,
  additionalContext?: any
): Promise<NormalizedResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let currentHistory = [...history];
  const toolCallsMade: ToolCallMade[] = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  const MAX_CYCLES = 5;

  for (let cycle = 0; cycle < MAX_CYCLES; cycle++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: currentHistory,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: GEMINI_TOOLS,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.2,
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error?.message ?? res.statusText;
      // Mensagem amigável para rate limit
      if (res.status === 429) {
        throw new Error("Limite de pedidos atingido (429). Aguarda um momento e tenta novamente.");
      }
      throw new Error(`Gemini ${res.status}: ${msg}`);
    }

    // Acumular uso de tokens
    totalPromptTokens     += data.usageMetadata?.promptTokenCount ?? 0;
    totalCompletionTokens += data.usageMetadata?.candidatesTokenCount ?? 0;

    const candidate = data.candidates?.[0];
    if (!candidate?.content?.parts) {
      throw new Error("Gemini devolveu resposta vazia.");
    }

    const parts: GeminiPart[] = candidate.content.parts;
    const textPart    = parts.find(p => p.text);
    const functionCalls = parts.filter(p => p.functionCall);

    // Sem tool calls → resposta final
    if (functionCalls.length === 0) {
      return {
        text: textPart?.text ?? "",
        toolCallsMade,
        usage: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
      };
    }

    // Adicionar a resposta do modelo ao histórico
    currentHistory.push({ role: "model", parts });

    // Processar cada tool call
    const responsesParts: GeminiPart[] = [];

    for (const part of functionCalls) {
      const { name, args } = part.functionCall!;

      // askUserInput → interrompe o ciclo e devolve ao frontend
      if (name === "askUserInput") {
        return {
          text: textPart?.text,
          toolCallsMade,
          askUserInput: args,
          usage: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
        };
      }

      // requestContext → resolve com dados do body e continua o ciclo
      if (name === "requestContext") {
        const contextData = resolveContextRequest(args, additionalContext);
        const result = { success: true, data: contextData };
        toolCallsMade.push({ name, args, result });
        responsesParts.push({ functionResponse: { name, response: result } });
        continue;
      }

      // Tools financeiras → interrompe e devolve ao frontend para confirmação
      if (FINANCIAL_TOOLS.has(name)) {
        return {
          text: textPart?.text,
          toolCallsMade: [...toolCallsMade, { name, args, result: "pending_confirmation" }],
          usage: { promptTokens: totalPromptTokens, completionTokens: totalCompletionTokens },
        };
      }

      // Tools silenciosas (updateUserProfile, etc.) → executa e continua
      const result = { success: true, message: `${name} executada.` };
      toolCallsMade.push({ name, args, result });
      responsesParts.push({
        functionResponse: { name, response: result },
      });
    }

    // Adicionar respostas das tools ao histórico e continuar o ciclo
    if (responsesParts.length > 0) {
      currentHistory.push({ role: "user", parts: responsesParts });
    }
  }

  throw new Error("Ciclo de tool calling excedeu o máximo de iterações.");
}

// ─────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { history, systemInstruction, model, clientApiKey, additionalContext } = body;

  const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave de API Gemini não configurada. Vai a ⚙️ Definições para configurar." },
      { status: 400 }
    );
  }

  if (!history || !Array.isArray(history)) {
    return NextResponse.json({ error: "history é obrigatório" }, { status: 400 });
  }

  // Converter histórico do formato interno (parts[]) para GeminiContent
  const geminiHistory: GeminiContent[] = history
    .filter((m: any) => m.role === "user" || m.role === "model")
    .map((m: any) => ({
      role: m.role as "user" | "model",
      parts: Array.isArray(m.parts) ? m.parts : [{ text: m.content ?? "" }],
    }));

  try {
    const result = await runGeminiCycle(geminiHistory, systemInstruction, model, apiKey, additionalContext);
    return NextResponse.json(result);
  } catch (err: any) {
    const errorMsg = err.message ?? "Erro interno";
    console.error(`[chat] model=${model} error=${errorMsg}`);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
