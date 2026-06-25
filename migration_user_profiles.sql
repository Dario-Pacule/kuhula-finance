-- Kuhula Finance — Migração: Perfil Persistente do Utilizador
-- Execute este SQL no Editor SQL do Supabase (https://supabase.com/dashboard)

-- Tabela para guardar o perfil aprendido pelo agente ao longo das conversas
CREATE TABLE IF NOT EXISTS user_profiles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       text NOT NULL UNIQUE,
  profile_json  jsonb NOT NULL DEFAULT '{}',
  updated_at    timestamptz DEFAULT now()
);

-- Índice para lookup por userId (já garantido pelo UNIQUE, mas útil para queries)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles (user_id);

-- Row Level Security (desactivado para service_role — apenas admin acede)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Comentário na tabela
COMMENT ON TABLE user_profiles IS
  'Perfil persistente do utilizador aprendido pelo agente Kuhula ao longo das conversas.
   Os campos são actualizados gradualmente via a ferramenta updateUserProfile.
   profile_json contém: name, occupation, monthlyIncome, incomeDay, familySize,
   primaryAccounts, financialGoalNarrative, behaviorNotes, lastUpdated.';
