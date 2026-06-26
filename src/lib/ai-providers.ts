export type ProviderId = "gemini" | "openai" | "anthropic" | "groq" | "openrouter";

export interface ModelOption {
  id: string;
  label: string;
  free: boolean;
  recommended?: boolean;
}

export interface ProviderConfig {
  id: ProviderId;
  label: string;
  keyPlaceholder: string;
  keyUrl: string;
  models: ModelOption[];
}

export const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    keyPlaceholder: "AIza...",
    keyUrl: "https://aistudio.google.com",
    models: [
      { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp", free: true, recommended: true },
      { id: "gemini-1.5-flash-latest", label: "Gemini 1.5 Flash Latest", free: true },
      { id: "gemini-1.5-flash-002", label: "Gemini 1.5 Flash 002", free: true },
      { id: "gemini-1.5-pro-latest",   label: "Gemini 1.5 Pro",   free: false },
    ],
  },
  {
    id: "openai",
    label: "OpenAI",
    keyPlaceholder: "sk-...",
    keyUrl: "https://platform.openai.com/api-keys",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o Mini",  free: false, recommended: true },
      { id: "gpt-4o",      label: "GPT-4o",        free: false },
      { id: "gpt-4-turbo", label: "GPT-4 Turbo",   free: false },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    keyPlaceholder: "sk-ant-...",
    keyUrl: "https://console.anthropic.com",
    models: [
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",  free: false, recommended: true },
      { id: "claude-sonnet-4-6",         label: "Claude Sonnet 4.6", free: false },
    ],
  },
  {
    id: "groq",
    label: "Groq (Gratuito)",
    keyPlaceholder: "gsk_...",
    keyUrl: "https://console.groq.com",
    models: [
      { id: "llama-3.3-70b-versatile", label: "LLaMA 3.3 70B", free: true, recommended: true },
      { id: "llama-3.1-8b-instant",    label: "LLaMA 3.1 8B",  free: true },
      { id: "mixtral-8x7b-32768",      label: "Mixtral 8x7B",  free: true },
    ],
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyPlaceholder: "sk-or-...",
    keyUrl: "https://openrouter.ai/keys",
    models: [
      { id: "meta-llama/llama-3.3-70b-instruct:free", label: "LLaMA 3.3 70B (Free)", free: true, recommended: true },
      { id: "google/gemini-2.5-flash-preview:free",        label: "Gemini 2.5 Flash (Free)", free: true },
      { id: "mistralai/mistral-7b-instruct:free",      label: "Mistral 7B (Free)", free: true },
      { id: "anthropic/claude-sonnet-4-6",             label: "Claude Sonnet 4.6", free: false },
      { id: "openai/gpt-4o",                           label: "GPT-4o", free: false },
    ],
  },
];

export function getProvider(id: ProviderId): ProviderConfig {
  return AI_PROVIDERS.find((p) => p.id === id) ?? AI_PROVIDERS[0];
}

export function getDefaultModel(id: ProviderId): string {
  const p = getProvider(id);
  return p.models.find((m) => m.recommended)?.id ?? p.models[0].id;
}
