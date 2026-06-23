-- ============================================================
-- Kuhula Finance — Schema PostgreSQL (Supabase)
-- ============================================================
-- Executa este ficheiro no SQL Editor do Supabase antes de
-- ligar a aplicação.
-- ============================================================

-- Extensão para UUIDs
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABELA: users
-- Criada automaticamente pelo Supabase Auth.
-- Apenas guardamos metadados adicionais em "profiles".
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency    text not null default 'MT',
  locale      text not null default 'pt-MZ',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABELA: accounts  (contas bancárias e carteiras)
-- ------------------------------------------------------------
create table if not exists public.accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  balance     numeric(14, 2) not null default 0,
  type        text not null default 'bank'  check (type in ('bank', 'wallet')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, name)
);

-- ------------------------------------------------------------
-- TABELA: transactions
-- ------------------------------------------------------------
create table if not exists public.transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  account_id   uuid references public.accounts(id) on delete set null,
  account_name text not null,
  description  text not null,
  amount       numeric(14, 2) not null check (amount > 0),
  type         text not null check (type in ('income', 'expense')),
  category     text not null default 'Outros',
  is_recurring boolean not null default false,
  day_of_month smallint check (day_of_month between 1 and 31),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABELA: goals  (metas de poupança)
-- ------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  target_amount  numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0,
  deadline       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, title)
);

-- ------------------------------------------------------------
-- TABELA: budget_limits  (limites de orçamento por categoria)
-- ------------------------------------------------------------
create table if not exists public.budget_limits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  category     text not null,
  limit_amount numeric(14, 2) not null check (limit_amount >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, category)
);

-- ------------------------------------------------------------
-- TABELA: strategies  (conselhos e estratégias da IA)
-- ------------------------------------------------------------
create table if not exists public.strategies (
  id          text not null,   -- ID semântico definido pela IA (ex: "strat-poupanca")
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text not null,
  type        text not null default 'info' check (type in ('info', 'warning', 'success', 'critical')),
  action_label text,
  frequency   text check (frequency in ('daily', 'weekly', 'monthly', 'one-time')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ------------------------------------------------------------
-- TABELA: chat_messages  (histórico de conversa)
-- ------------------------------------------------------------
create table if not exists public.chat_messages (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null check (role in ('user', 'model')),
  content    text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABELA: ai_providers  (configuração de LLM por utilizador)
-- ------------------------------------------------------------
create table if not exists public.ai_providers (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  provider   text not null default 'gemini' check (provider in ('gemini', 'openai', 'anthropic', 'groq', 'openrouter')),
  model      text not null default 'gemini-2.5-flash',
  -- A chave é encriptada pelo Supabase Vault em produção.
  -- Em dev, guarda em texto simples (nunca commites chaves reais).
  api_key_encrypted text,
  submit_on_enter boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ÍNDICES  (performance em queries comuns)
-- ------------------------------------------------------------
create index if not exists idx_transactions_user_date
  on public.transactions (user_id, date desc);

create index if not exists idx_transactions_user_type
  on public.transactions (user_id, type);

create index if not exists idx_transactions_recurring
  on public.transactions (user_id, is_recurring) where is_recurring = true;

create index if not exists idx_chat_messages_user
  on public.chat_messages (user_id, created_at desc);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY  (cada utilizador só vê os seus dados)
-- ------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.accounts       enable row level security;
alter table public.transactions   enable row level security;
alter table public.goals          enable row level security;
alter table public.budget_limits  enable row level security;
alter table public.strategies     enable row level security;
alter table public.chat_messages  enable row level security;
alter table public.ai_providers   enable row level security;

-- Políticas: cada utilizador tem acesso total apenas aos seus próprios dados
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','accounts','transactions','goals',
    'budget_limits','strategies','chat_messages','ai_providers'
  ] loop
    execute format(
      'create policy "owner_all_%s" on public.%I
       for all using (auth.uid() = user_id)
       with check (auth.uid() = user_id)', t, t
    );
  end loop;
end $$;

-- Perfil criado automaticamente ao registar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.ai_providers (user_id)
  values (new.id);

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','accounts','goals','budget_limits','strategies','ai_providers'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at_%s on public.%I;
       create trigger trg_updated_at_%s
       before update on public.%I
       for each row execute procedure public.set_updated_at()', t, t, t, t
    );
  end loop;
end $$;
