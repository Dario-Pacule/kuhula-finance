-- Kuhula Finance — Migration 0002: chat analytics tables
-- chat_sessions e chat_events para análise detalhada de conversas

-- ── chat_sessions ─────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  provider         text not null default 'gemini',
  model            text not null,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  message_count    integer not null default 0,
  total_prompt_tokens     integer not null default 0,
  total_completion_tokens integer not null default 0
);

create index if not exists idx_chat_sessions_user
  on public.chat_sessions (user_id, started_at desc);

alter table public.chat_sessions enable row level security;
create policy "owner_all_chat_sessions" on public.chat_sessions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── chat_events ───────────────────────────────────────────────
create table if not exists public.chat_events (
  id               bigint generated always as identity primary key,
  session_id       uuid not null references public.chat_sessions(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,

  -- Tipo de evento
  event_type       text not null check (event_type in (
    'user_message',
    'ai_response',
    'ai_error',
    'tool_call',
    'tool_confirmed',
    'tool_cancelled',
    'tool_input',
    'tool_answered'
  )),

  -- Conteúdo
  content          text,                    -- texto da mensagem ou descrição
  tool_name        text,                    -- nome da tool (se aplicável)
  tool_args        jsonb,                   -- argumentos da tool
  tool_result      jsonb,                   -- resultado/resposta da tool

  -- Performance
  latency_ms       integer,                 -- tempo de resposta da API em ms
  prompt_tokens    integer,
  completion_tokens integer,
  provider         text,
  model            text,

  -- Erros
  error_code       text,
  error_message    text,

  created_at       timestamptz not null default now()
);

create index if not exists idx_chat_events_session
  on public.chat_events (session_id, created_at);

create index if not exists idx_chat_events_user_type
  on public.chat_events (user_id, event_type, created_at desc);

create index if not exists idx_chat_events_tool
  on public.chat_events (tool_name, created_at desc)
  where tool_name is not null;

alter table public.chat_events enable row level security;
create policy "owner_all_chat_events" on public.chat_events
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Função para incrementar contadores da sessão atomicamente
create or replace function public.increment_session_stats(
  p_session_id        uuid,
  p_message_count     integer default 0,
  p_prompt_tokens     integer default 0,
  p_completion_tokens integer default 0
) returns void language plpgsql security definer as $$
begin
  update public.chat_sessions set
    message_count           = message_count + p_message_count,
    total_prompt_tokens     = total_prompt_tokens + p_prompt_tokens,
    total_completion_tokens = total_completion_tokens + p_completion_tokens,
    ended_at                = now()
  where id = p_session_id;
end $$;
