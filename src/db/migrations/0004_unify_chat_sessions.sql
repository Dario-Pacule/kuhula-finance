-- Migration 0004: unificar chat_sessions com chat_threads
-- chat_threads é obsoleta — chat_sessions passa a ter title + updated_at
-- para suportar múltiplas conversas com nome

-- Adicionar colunas de conversas à chat_sessions
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT 'Nova Conversa',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Adicionar session_id ao chat_messages para ligação às sessões
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.chat_sessions(id) ON DELETE CASCADE;

-- Índices
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON public.chat_sessions (user_id, updated_at DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_updated_at_chat_sessions ON public.chat_sessions;
CREATE TRIGGER trg_updated_at_chat_sessions
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- RLS em tabelas que não tinham
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kuhula_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_only_migrations" ON public.kuhula_migrations;
CREATE POLICY "service_only_migrations" ON public.kuhula_migrations
  FOR ALL USING (false);

DROP POLICY IF EXISTS "owner_all_profiles" ON public.profiles;
CREATE POLICY "owner_all_profiles" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
