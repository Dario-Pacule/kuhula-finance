import { NextResponse } from 'next/server';

const SYSTEM_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "addTransaction",
        description: "Adiciona uma nova transação financeira (despesa ou receita) ao painel do usuário.",
        parameters: {
          type: "OBJECT",
          properties: {
            amount: { type: "NUMBER", description: "Valor monetário da transação em Meticais (MT)." },
            type: { type: "STRING", enum: ["income", "expense"], description: "Tipo da transação: 'income' para receitas e 'expense' para despesas." },
            category: { type: "STRING", description: "Categoria (ex: Alimentação, Credelec, Aluguer, Transporte, Salário, Internet, Lazer, Saúde)." },
            account: { type: "STRING", description: "A conta usada para a transação. Ex: M-Pesa, e-Mola, BCI, Millennium Bim, Standard Bank ou Carteira." },
            description: { type: "STRING", description: "Breve descrição (ex: Recarga de energia, Supermercado Recheio, Compra de pão)." },
            isRecurring: { type: "BOOLEAN", description: "Indica se é uma receita ou despesa recorrente mensalmente." },
            dayOfMonth: { type: "INTEGER", description: "Se isRecurring for verdadeiro, informe o dia do mês (1-31) em que esta transação repete-se." }
          },
          required: ["amount", "type", "category", "account", "description"]
        }
      },
      {
        name: "deleteTransaction",
        description: "Exclui uma transação existente usando o ID da transação.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "O identificador exclusivo da transação (ex: 'tx-1')." }
          },
          required: ["id"]
        }
      },
      {
        name: "createOrUpdateGoal",
        description: "Cria uma nova meta financeira ou atualiza o progresso de uma meta existente.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "Nome/Título da meta financeira (ex: Reserva de Emergência, Seguro de Carro)." },
            targetAmount: { type: "NUMBER", description: "Valor total alvo a poupar em Meticais (MT)." },
            currentAmount: { type: "NUMBER", description: "Valor que já foi poupado até o momento para essa meta." },
            deadline: { type: "STRING", description: "Data limite no formato AAAA-MM-DD." }
          },
          required: ["title", "targetAmount"]
        }
      },
      {
        name: "deleteGoal",
        description: "Apaga uma meta financeira da lista de metas.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "O título da meta que deseja excluir." }
          },
          required: ["title"]
        }
      },
      {
        name: "adjustAccountBalance",
        description: "Ajusta diretamente o saldo atual de uma conta ou carteira do usuário (correção manual).",
        parameters: {
          type: "OBJECT",
          properties: {
            accountName: { type: "STRING", description: "Nome da conta ou carteira (ex: M-Pesa, BCI, Millennium Bim)." },
            balance: { type: "NUMBER", description: "O novo valor exato do saldo atual da conta em Meticais (MT)." }
          },
          required: ["accountName", "balance"]
        }
      },
      {
        name: "deleteAccount",
        description: "Remove permanentemente uma conta ou carteira do utilizador do painel.",
        parameters: {
          type: "OBJECT",
          properties: {
            accountName: { type: "STRING", description: "Nome exato da conta ou carteira a remover (ex: M-Pesa, BCI)." }
          },
          required: ["accountName"]
        }
      },
      {
        name: "setBudgetLimit",
        description: "Define um limite máximo mensal de orçamento para gastos de uma determinada categoria.",
        parameters: {
          type: "OBJECT",
          properties: {
            category: { type: "STRING", description: "Categoria de despesa à qual aplicar o limite (ex: Alimentação, Lazer)." },
            limitAmount: { type: "NUMBER", description: "Limite de gastos mensal máximo em Meticais (MT)." }
          },
          required: ["category", "limitAmount"]
        }
      },
      {
        name: "createOrUpdateStrategy",
        description: "Adiciona ou atualiza um cartão de estratégia financeira recomendada, dica ou alerta visual no painel do utilizador.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "Identificador único para a estratégia (ex: 'strat-poupanca-combustivel')." },
            title: { type: "STRING", description: "Título do cartão (ex: 'Otimização de Custos de Transporte')." },
            description: { type: "STRING", description: "O texto explicativo da recomendação, conselho ou alerta." },
            type: { type: "STRING", enum: ["info", "warning", "success", "critical"], description: "Estilo visual do cartão: info (azul/neutro), warning (amarelo), success (verde), critical (vermelho)." },
            actionLabel: { type: "STRING", description: "Texto opcional para um botão de ação (ex: 'Ver Dicas', 'Verificar Limites')." },
            frequency: { type: "STRING", enum: ["daily", "weekly", "monthly", "one-time"], description: "Frequência recomendada para esta ação/estratégia (diária, semanal, mensal ou pontual)." }
          },
          required: ["id", "title", "description", "type"]
        }
      },
      {
        name: "deleteStrategy",
        description: "Remove um cartão de recomendação ou estratégia do painel usando o seu identificador único (id).",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "STRING", description: "O ID único do cartão a remover (ex: 'strat-1')." }
          },
          required: ["id"]
        }
      }
    ]
  }
];

export async function POST(req: Request) {
  try {
    const { history, systemInstruction, model = 'gemini-2.5-flash', clientApiKey } = await req.json();

    // Prioriza a chave enviada pelo cliente (via modal). Se não houver, usa a do arquivo de ambiente do servidor.
    const key = clientApiKey || process.env.GEMINI_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: { message: "Chave de API do Gemini não configurada. Configure-a nas Definições do aplicativo." } },
        { status: 400 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const payload = {
      contents: history,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      tools: SYSTEM_TOOLS,
      generationConfig: {
        maxOutputTokens: 600,
        temperature: 0.2
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: { message: data.error?.message || `Erro do Gemini: ${response.statusText}` } },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in API Chat route:', error);
    return NextResponse.json(
      { error: { message: error.message || 'Internal Server Error' } },
      { status: 500 }
    );
  }
}
