-- Kuhula Finance — Migration 0001: schema inicial
-- Gerada automaticamente. Não editar manualmente.
-- Para alterar o schema, modifica src/db/schema.ts e corre:
--   npx drizzle-kit generate

create extension if not exists "pgcrypto";

-- profiles
create table if not exists "public"."profiles" (
  "id"           uuid primary key,
  "display_name" text,
  "currency"     text not null default 'MT',
  "locale"       text not null default 'pt-MZ',
  "created_at"   timestamptz not null default now(),
  "updated_at"   timestamptz not null default now()
);

-- accounts
create table if not exists "public"."accounts" (
  "id"         uuid primary key default gen_random_uuid(),
  "user_id"    uuid not null,
  "name"       text not null,
  "balance"    numeric(14,2) not null default 0,
  "type"       text not null default 'bank',
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
create unique index if not exists "accounts_user_name_idx" on "public"."accounts"("user_id","name");

-- transactions
create table if not exists "public"."transactions" (
  "id"           uuid primary key default gen_random_uuid(),
  "user_id"      uuid not null,
  "account_id"   uuid,
  "account_name" text not null,
  "description"  text not null,
  "amount"       numeric(14,2) not null,
  "type"         text not null,
  "category"     text not null default 'Outros',
  "is_recurring" boolean not null default false,
  "day_of_month" smallint,
  "date"         date not null default current_date,
  "created_at"   timestamptz not null default now()
);
create index if not exists "idx_transactions_user_date" on "public"."transactions"("user_id","date");
create index if not exists "idx_transactions_user_type" on "public"."transactions"("user_id","type");

-- goals
create table if not exists "public"."goals" (
  "id"             uuid primary key default gen_random_uuid(),
  "user_id"        uuid not null,
  "title"          text not null,
  "target_amount"  numeric(14,2) not null,
  "current_amount" numeric(14,2) not null default 0,
  "deadline"       date,
  "created_at"     timestamptz not null default now(),
  "updated_at"     timestamptz not null default now()
);
create unique index if not exists "goals_user_title_idx" on "public"."goals"("user_id","title");

-- budget_limits
create table if not exists "public"."budget_limits" (
  "id"           uuid primary key default gen_random_uuid(),
  "user_id"      uuid not null,
  "category"     text not null,
  "limit_amount" numeric(14,2) not null,
  "created_at"   timestamptz not null default now(),
  "updated_at"   timestamptz not null default now()
);
create unique index if not exists "budget_limits_user_category_idx" on "public"."budget_limits"("user_id","category");

-- strategies
create table if not exists "public"."strategies" (
  "id"           text not null,
  "user_id"      uuid not null,
  "title"        text not null,
  "description"  text not null,
  "type"         text not null default 'info',
  "action_label" text,
  "frequency"    text,
  "created_at"   timestamptz not null default now(),
  "updated_at"   timestamptz not null default now(),
  primary key ("user_id","id")
);

-- chat_messages
create table if not exists "public"."chat_messages" (
  "id"         bigint generated always as identity primary key,
  "user_id"    uuid not null,
  "role"       text not null,
  "content"    text not null,
  "created_at" timestamptz not null default now()
);
create index if not exists "idx_chat_messages_user" on "public"."chat_messages"("user_id","created_at");

-- ai_providers
create table if not exists "public"."ai_providers" (
  "user_id"           uuid primary key,
  "provider"          text not null default 'gemini',
  "model"             text not null default 'gemini-2.5-flash',
  "api_key_encrypted" text,
  "submit_on_enter"   boolean not null default true,
  "created_at"        timestamptz not null default now(),
  "updated_at"        timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['profiles','accounts','goals','budget_limits','strategies','ai_providers'] loop
    execute format(
      'drop trigger if exists trg_updated_at_%s on public.%I;
       create trigger trg_updated_at_%s before update on public.%I
       for each row execute procedure public.set_updated_at()', t,t,t,t
    );
  end loop;
end $$;

-- RLS
do $$ declare t text; begin
  foreach t in array array['profiles','accounts','transactions','goals','budget_limits','strategies','chat_messages','ai_providers'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'drop policy if exists "owner_all_%s" on public.%I;
       create policy "owner_all_%s" on public.%I
       for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t,t,t,t
    );
  end loop;
end $$;

-- profiles: user_id não se chama user_id mas id
drop policy if exists "owner_all_profiles" on public.profiles;
create policy "owner_all_profiles" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

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

-- Backfill: utilizadores existentes
insert into public.ai_providers (user_id)
select id from auth.users
where id not in (select user_id from public.ai_providers)
on conflict (user_id) do nothing;
