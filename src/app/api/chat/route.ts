/**
 * POST /api/chat
 *
 * Rota unificada para todos os providers de IA.
 * Recebe o histórico e systemInstruction, encaminha para o provider
 * correcto, e devolve a resposta num formato normalizado.
 *
 * Formato de resposta normalizado:
 * {
 *   text?: string,
 *   toolCalls?: Array<{ name: string, args: any }>,
 *   usage?: { promptTokens: number, completionTokens: number }
 * }
 */

import { NextResponse } from "next/server";

// ── Tipos ────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

interface ToolCall {
  name: string;
  args: Record<string, any>;
}

interface NormalizedResponse {
  text?: string;
  toolCalls?: ToolCall[];
  usage?: { promptTokens: number; completionTokens: number };
  error?: string;
}

// ── Definições das tools (agnósticas ao provider) ────────────

const TOOL_DEFINITIONS = {
  addTransaction: {
    description: "Adiciona uma nova transacção financeira (despesa ou receita) ao painel.",
    parameters: {
      amount: { type: "number", description: "Valor em Meticais (MT)." },
      type: { type: "string", enum: ["income", "expense"] },
      category: { type: "string", description: "Ex: Alimentação, Transporte, Salário." },
      account: { type: "string", description: "Ex: M-Pesa, BCI, e-Mola." },
      description: { type: "string", description: "Descrição breve." },
      isRecurring: { type: "boolean" },
      dayOfMonth: { type: "integer", description: "Dia do mês se recorrente (1-31)." },
    },
    required: ["amount", "type", "category", "account", "description"],
  },
  deleteTransaction: {
    description: "Remove uma transacção pelo ID.",
    parameters: { id: { type: "string" } },
    required: ["id"],
  },
  createOrUpdateGoal: {
    description: "Cria ou actualiza uma meta de poupança.",
    parameters: {
      title: { type: "string" },
      targetAmount: { type: "number" },
      currentAmount: { type: "number" },
      deadline: { type: "string", description: "AAAA-MM-DD" },
    },
    required: ["title", "targetAmount"],
  },
  deleteGoal: {
    description: "Remove uma meta de poupança.",
    parameters: { title: { type: "string" } },
    required: ["title"],
  },
  adjustAccountBalance: {
    description: "Ajusta o saldo de uma conta.",
    parameters: {
      accountName: { type: "string" },
      balance: { type: "number" },
    },
    required: ["accountName", "balance"],
  },
  deleteAccount: {
    description: "Remove uma conta ou carteira.",
    parameters: { accountName: { type: "string" } },
    required: ["accountName"],
  },
  setBudgetLimit: {
    description: "Define limite mensal para uma categoria.",
    parameters: {
      category: { type: "string" },
      limitAmount: { type: "number" },
    },
    required: ["category", "limitAmount"],
  },
  createOrUpdateStrategy: {
    description: "Cria ou actualiza um cartão de estratégia/conselho no painel.",
    parameters: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      type: { type: "string", enum: ["info", "warning", "success", "critical"] },
      actionLabel: { type: "string" },
      frequency: { type: "string", enum: ["daily", "weekly", "monthly", "one-time"] },
    },
    required: ["id", "title", "description", "type"],
  },
  deleteStrategy: {
    description: "Remove um cartão de estratégia.",
    parameters: { id: { type: "string" } },
    required: ["id"],
  },
};

// ── Helpers para construir tools por provider ────────────────

function buildGeminiTools() {
  return [{
    functionDeclarations: Object.entries(TOOL_DEFINITIONS).map(([name, def]) => ({
      name,
      description: def.description,
      parameters: {
        type: "OBJECT",
        properties: Object.fromEntries(
          Object.entries(def.parameters).map(([k, v]) => [k, {
            type: (v as any).type?.toUpperCase() ?? "STRING",
            description: (v as any).description,
            enum: (v as any).enum,
          }])
        ),
        required: def.required,
      },
    })),
  }];
}

function buildOpenAITools() {
  return Object.entries(TOOL_DEFINITIONS).map(([name, def]) => ({
    type: "function",
    function: {
      name,
      description: def.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(def.parameters).map(([k, v]) => [k, {
            type: (v as any).type === "integer" ? "number" : (v as any).type,
            description: (v as any).description,
            enum: (v as any).enum,
          }])
        ),
        required: def.required,
      },
    },
  }));
}

// Anthropic e Groq usam o mesmo formato de tools
function buildAnthropicTools() {
  return Object.entries(TOOL_DEFINITIONS).map(([name, def]) => ({
    name,
    description: def.description,
    input_schema: {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(def.parameters).map(([k, v]) => [k, {
          type: (v as any).type === "integer" ? "number" : (v as any).type,
          description: (v as any).description,
          enum: (v as any).enum,
        }])
      ),
      required: def.required,
    },
  }));
}

// ── Adaptadores por provider ─────────────────────────────────

async function callGemini(
  history: ChatMessage[],
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<NormalizedResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const geminiHistory = history.map((m) => ({
    role: m.role === "assistant" ? "model" : m.role,
    parts: [{ text: m.content }],
  }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: geminiHistory,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: buildGeminiTools(),
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${data.error?.message ?? res.statusText}`);

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((p: any) => p.text);
  const toolCalls = parts
    .filter((p: any) => p.functionCall)
    .map((p: any) => ({ name: p.functionCall.name, args: p.functionCall.args }));

  return {
    text: textPart?.text,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage: {
      promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}

async function callOpenAI(
  history: ChatMessage[],
  systemInstruction: string,
  model: string,
  apiKey: string,
  baseURL = "https://api.openai.com/v1"
): Promise<NormalizedResponse> {
  const messages = [
    { role: "system", content: systemInstruction },
    ...history.map((m) => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content,
    })),
  ];

  const res = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      tools: buildOpenAITools(),
      tool_choice: "auto",
      max_tokens: 2048,
      temperature: 0.2,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data.error?.message ?? res.statusText}`);

  const choice = data.choices?.[0];
  const toolCalls = (choice?.message?.tool_calls ?? []).map((tc: any) => ({
    name: tc.function.name,
    args: JSON.parse(tc.function.arguments ?? "{}"),
  }));

  return {
    text: choice?.message?.content ?? undefined,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
  };
}

async function callAnthropic(
  history: ChatMessage[],
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<NormalizedResponse> {
  const messages = history.map((m) => ({
    role: m.role === "model" ? "assistant" : "user",
    content: m.content,
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemInstruction,
      messages,
      tools: buildAnthropicTools(),
      max_tokens: 2048,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${data.error?.message ?? res.statusText}`);

  const textBlock = data.content?.find((b: any) => b.type === "text");
  const toolCalls = (data.content ?? [])
    .filter((b: any) => b.type === "tool_use")
    .map((b: any) => ({ name: b.name, args: b.input }));

  return {
    text: textBlock?.text,
    toolCalls: toolCalls.length ? toolCalls : undefined,
    usage: {
      promptTokens: data.usage?.input_tokens ?? 0,
      completionTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

async function callGroq(
  history: ChatMessage[],
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<NormalizedResponse> {
  // Groq é compatível com a API OpenAI
  return callOpenAI(history, systemInstruction, model, apiKey, "https://api.groq.com/openai/v1");
}

async function callOpenRouter(
  history: ChatMessage[],
  systemInstruction: string,
  model: string,
  apiKey: string
): Promise<NormalizedResponse> {
  return callOpenAI(history, systemInstruction, model, apiKey, "https://openrouter.ai/api/v1");
}

// ── Handler principal ────────────────────────────────────────

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    history,
    systemInstruction,
    provider = "gemini",
    model,
    clientApiKey,
  } = body;

  // Chave: prioridade → enviada pelo cliente, depois variável de ambiente
  const envKeys: Record<string, string | undefined> = {
    gemini: process.env.GEMINI_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
  };

  const apiKey = clientApiKey || envKeys[provider];

  if (!apiKey) {
    return NextResponse.json(
      { error: `Chave de API para o provider "${provider}" não configurada.` },
      { status: 400 }
    );
  }

  try {
    let result: NormalizedResponse;

    switch (provider) {
      case "gemini":
        result = await callGemini(history, systemInstruction, model, apiKey);
        break;
      case "openai":
        result = await callOpenAI(history, systemInstruction, model, apiKey);
        break;
      case "anthropic":
        result = await callAnthropic(history, systemInstruction, model, apiKey);
        break;
      case "groq":
        result = await callGroq(history, systemInstruction, model, apiKey);
        break;
      case "openrouter":
        result = await callOpenRouter(history, systemInstruction, model, apiKey);
        break;
      default:
        return NextResponse.json({ error: `Provider desconhecido: ${provider}` }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    const errorMsg = err.message ?? "Erro interno";
    console.error(`[chat API] provider=${provider} model=${model} error=${errorMsg}`);
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
