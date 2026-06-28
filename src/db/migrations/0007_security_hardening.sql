-- Migration 0007: security hardening
-- RLS policies com WITH CHECK em todas as tabelas
-- Tabelas sem política recebem política explícita

-- user_profiles: user_id é text
DROP POLICY IF EXISTS "owner_all_user_profiles" ON public.user_profiles;
CREATE POLICY "owner_all_user_profiles" ON public.user_profiles
  FOR ALL USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- chat_threads obsoleta: bloquear tudo
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "block_all_chat_threads" ON public.chat_threads;
CREATE POLICY "block_all_chat_threads" ON public.chat_threads
  FOR ALL USING (false);

-- Garantir WITH CHECK em todas as políticas principais
DROP POLICY IF EXISTS "owner_all_accounts" ON public.accounts;
CREATE POLICY "owner_all_accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_transactions" ON public.transactions;
CREATE POLICY "owner_all_transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_goals" ON public.goals;
CREATE POLICY "owner_all_goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_strategies" ON public.strategies;
CREATE POLICY "owner_all_strategies" ON public.strategies
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_chat_sessions" ON public.chat_sessions;
CREATE POLICY "owner_all_chat_sessions" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_chat_messages" ON public.chat_messages;
CREATE POLICY "owner_all_chat_messages" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_all_chat_events" ON public.chat_events;
CREATE POLICY "owner_all_chat_events" ON public.chat_events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
