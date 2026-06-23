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

export interface AppState {
  accounts: Record<string, number>;
  transactions: Transaction[];
  goals: Goal[];
  budgetLimits: Record<string, number>;
  strategies?: FinancialStrategy[];
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
  type: "single" | "multiple" | "confirm" | "slider";
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
}
