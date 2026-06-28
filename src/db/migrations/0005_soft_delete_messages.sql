-- Migration 0005: soft delete em chat_messages + nomes únicos de sessão

-- Soft delete em chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_not_deleted
  ON public.chat_messages (user_id, session_id)
  WHERE deleted_at IS NULL;

-- Unique index para nomes de sessão por utilizador
-- (case-insensitive via lower())
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_sessions_user_title_unique
  ON public.chat_sessions (user_id, lower(title));
