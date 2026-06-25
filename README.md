# Kuhula Finance

Gestor financeiro pessoal com IA conversacional, construído para o contexto moçambicano. Em vez de formulários, conversas com a IA que organizam o painel automaticamente.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | Tailwind CSS v4 + Shadcn UI |
| Gráficos | Recharts |
| Base de Dados | Supabase (PostgreSQL) |
| IA | Gemini, OpenAI, Anthropic, Groq, OpenRouter |

---

## Pré-requisitos

- Node.js 18+
- Conta [Supabase](https://supabase.com) (plano gratuito chega)
- Chave de API de pelo menos um provider de IA (ver secção abaixo)

---

## Instalação

### 1. Clonar o repositório

```bash
git clone https://github.com/Dario-Pacule/kuhula-finance.git
cd kuhula-finance
npm install
```

### 2. Configurar o Supabase

**2.1 — Criar o projecto**

1. Vai a [supabase.com](https://supabase.com) → New project
2. Escolhe uma região próxima (ex: `eu-west-1`)
3. Guarda a password do projecto em local seguro

**2.2 — Criar as tabelas**

1. No painel Supabase, vai a **SQL Editor**
2. Cola o conteúdo do ficheiro `supabase/schema.sql`
3. Clica **Run**

Isto cria todas as tabelas, índices, Row Level Security e triggers automaticamente.

**2.3 — Copiar as chaves**

Vai a **Settings → API** e copia:

| Variável | Onde encontrar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (nunca expor no browser) |

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env.local
```

Abre `.env.local` e preenche os valores do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
```

As chaves de IA são opcionais no servidor — o utilizador pode configurá-las directamente na app. Mas se quiseres definir um provider padrão para todos:

```env
# Pelo menos um dos seguintes
GEMINI_API_KEY=AIza...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
OPENROUTER_API_KEY=sk-or-...
```

### 4. Arrancar o servidor de desenvolvimento

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Configurar o provider de IA na app

Na app, clica no ícone ⚙️ (configurações) e escolhe:

| Provider | Modelos gratuitos | Onde obter a chave |
|---|---|---|
| **Google Gemini** | Gemini 2.5 Flash, 2.0 Flash | [aistudio.google.com](https://aistudio.google.com) |
| **Groq** | LLaMA 3.3 70B, Mixtral | [console.groq.com](https://console.groq.com) |
| **OpenRouter** | LLaMA 3.3 70B, Gemini 2.0 Flash, Mistral 7B | [openrouter.ai/keys](https://openrouter.ai/keys) |
| OpenAI | — | [platform.openai.com](https://platform.openai.com/api-keys) |
| Anthropic | — | [console.anthropic.com](https://console.anthropic.com) |

> **Recomendado para começar sem custo:** Groq com LLaMA 3.3 70B ou Google Gemini 2.5 Flash.

A chave é guardada localmente no dispositivo (nunca enviada para os nossos servidores).

---

## Deploy na Vercel

### 1. Ligar o repositório

1. Vai a [vercel.com](https://vercel.com) → New Project
2. Importa o repositório do GitHub
3. Framework preset: **Next.js** (detectado automaticamente)

### 2. Configurar variáveis de ambiente

Em **Settings → Environment Variables**, adiciona as mesmas variáveis do `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

E as chaves de IA que quiseres disponibilizar como padrão (opcional).

### 3. Deploy

Clica **Deploy**. A Vercel detecta Next.js automaticamente e faz o build.

---

## Estrutura do projecto

```
kuhula-finance/
├── supabase/
│   └── schema.sql          # Schema completo — corre no SQL Editor do Supabase
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts        # API unificada multi-provider de IA
│   │   │   ├── state/
│   │   │   │   └── route.ts        # CRUD atómico do estado financeiro
│   │   │   └── chat-history/
│   │   │       └── route.ts        # Histórico de conversa
│   │   └── page.tsx                # Componente principal
│   ├── hooks/
│   │   └── usePersistence.ts       # Hook de sincronização DB + localStorage
│   ├── lib/
│   │   ├── supabase.ts             # Cliente Supabase (browser + servidor)
│   │   ├── db.ts                   # Camada de acesso a dados
│   │   └── ai-providers.ts         # Configuração dos providers de IA
│   └── types/
│       └── index.ts                # Tipos TypeScript
├── docs/
│   └── migration-mongodb-to-supabase.md
└── .env.example
```

---

## Branches activas

| Branch | Descrição |
|---|---|
| `main` | Versão estável |
| `improve/ai-conversation` | System prompt melhorado, memória de sessão, histórico ampliado |
| `improve/supabase-persistence` | Migração para Supabase + multi-provider de IA |

Para usar todas as melhorias, faz merge das branches por esta ordem:
```bash
git checkout main
git merge improve/ai-conversation
git merge improve/supabase-persistence
```

---

## Licença

MIT

---

## Migrations automáticas

O projecto usa **Drizzle ORM** para gerir o schema da DB. As migrations correm automaticamente no arranque do servidor via `instrumentation.ts`.

### Configurar

Adiciona ao `.env.local` (e às variáveis de ambiente da Vercel):

```env
# Supabase Dashboard → Settings → Database → Connection string (Direct)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres
```

Ou só a password (o URL é construído automaticamente):
```env
SUPABASE_DB_PASSWORD=your-database-password
```

### Como funciona

1. No arranque, `instrumentation.ts` chama `runMigrations()`
2. Cria a tabela `kuhula_migrations` se não existir
3. Verifica quais ficheiros em `src/db/migrations/` ainda não foram aplicados
4. Aplica cada ficheiro por ordem e regista na tabela de controlo
5. Re-executar é seguro — migrations já aplicadas são ignoradas

### Adicionar uma nova migration

1. Altera `src/db/schema.ts`
2. Cria `src/db/migrations/0002_nome_descritivo.sql` com o SQL de alteração
3. Faz deploy — a migration corre automaticamente
