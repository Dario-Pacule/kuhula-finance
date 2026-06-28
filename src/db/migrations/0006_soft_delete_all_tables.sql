-- Migration 0006: soft delete universal com status + archived_at
-- Regra: NUNCA apagar dados — sempre arquivar ou marcar como eliminado

-- chat_sessions
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_active
  ON public.chat_sessions (user_id, status)
  WHERE status = 'active';

-- chat_messages (já tem deleted_at — migrar para status)
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deleted'));

UPDATE public.chat_messages
  SET status = 'deleted'
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_active
  ON public.chat_messages (session_id, status)
  WHERE status = 'active';

-- transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- goals
ALTER TABLE public.goals
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- strategies
ALTER TABLE public.strategies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;
