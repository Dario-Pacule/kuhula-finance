-- ============================================================
-- Kuhula Finance — Patch: tabelas em falta
-- Corre este ficheiro no SQL Editor do Supabase se já tiveste
-- corrido o schema.sql original mas as tabelas não existem.
-- É seguro correr múltiplas vezes (IF NOT EXISTS).
-- ============================================================

-- ai_providers
create table if not exists public.ai_providers (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  provider            text not null default 'gemini'
                        check (provider in ('gemini','openai','anthropic','groq','openrouter')),
  model               text not null default 'gemini-2.5-flash',
  api_key_encrypted   text,
  submit_on_enter     boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.ai_providers enable row level security;

drop policy if exists "owner_all_ai_providers" on public.ai_providers;
create policy "owner_all_ai_providers" on public.ai_providers
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- chat_messages
create table if not exists public.chat_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('user','model')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_chat_messages_user
  on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

drop policy if exists "owner_all_chat_messages" on public.chat_messages;
create policy "owner_all_chat_messages" on public.chat_messages
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Trigger updated_at para ai_providers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_updated_at_ai_providers on public.ai_providers;
create trigger trg_updated_at_ai_providers
  before update on public.ai_providers
  for each row execute procedure public.set_updated_at();

-- Trigger: cria perfil + ai_providers ao registar utilizador
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;

  insert into public.ai_providers (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Garantir que utilizadores existentes têm linha em ai_providers
insert into public.ai_providers (user_id)
select id from auth.users
where id not in (select user_id from public.ai_providers)
on conflict (user_id) do nothing;
