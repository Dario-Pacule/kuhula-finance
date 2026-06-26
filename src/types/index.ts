// Kuhula Finance Types Definitions

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  account: string;
  date: string;
  isRecurring: boolean;
  dayOfMonth?: number | null;
}

export interface Goal {
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
}

export interface FinancialStrategy {
  id: string;
  title: string;
  description: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  actionLabel?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'one-time';
}

/**
 * Perfil persistente do utilizador — aprendido pelo agente ao longo das conversas.
 * O agente preenche este perfil gradualmente usando a ferramenta updateUserProfile.
 */
export interface UserProfile {
  name?: string;
  occupation?: string;
  monthlyIncome?: number;
  incomeDay?: number;         // Dia do mês em que recebe o salário
  familySize?: number;        // Nº de dependentes financeiros
  primaryAccounts?: string[]; // Contas que usa habitualmente
  financialGoalNarrative?: string; // Resumo dos objectivos financeiros
  behaviorNotes?: string;     // Padrões de comportamento observados pelo agente
  lastUpdated?: string;       // ISO date da última actualização
}

export interface AppState {
  accounts: Record<string, number>;
  transactions: Transaction[];
  goals: Goal[];
  budgetLimits: Record<string, number>;
  strategies?: FinancialStrategy[];
  userProfile?: UserProfile;
}

export interface ChatPart {
  text?: string;
  functionCall?: {
    name: string;
    args: any;
  };
  functionResponse?: {
    name: string;
    response: any;
  };
}

export interface AskUserInputArgs {
  question: string;
  inputType: "single" | "multiple" | "confirm" | "slider";
  options?: string;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderUnit?: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system' | 'interactive';
  parts: ChatPart[];
  interactiveInput?: {
    args: AskUserInputArgs;
    answered?: boolean;
    answeredValue?: string;
  };
  isError?: boolean;
  retryText?: string;
  /** Marcado em mensagens interactivas que representam uma confirmação de operação financeira */
  isPendingFinancial?: boolean;
  timestamp?: string;
}
