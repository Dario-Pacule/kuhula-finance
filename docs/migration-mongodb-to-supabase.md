# Migração: MongoDB → Supabase (PostgreSQL)

## O que mudou

| Antes (MongoDB) | Depois (Supabase) |
|---|---|
| 1 documento JSON monolítico | Tabelas relacionais separadas |
| Sem utilizadores | Multi-utilizador com RLS |
| Chat só em localStorage | Chat persistido na DB |
| `POST /api/state` (blob completo) | `POST /api/state` (operações atómicas) |
| Sem validação de schema | Constraints e tipos no PostgreSQL |

---

## Passo 1 — Criar projeto Supabase

1. Acede a [supabase.com](https://supabase.com) e cria um projeto gratuito
2. Vai a **Settings → API** e copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## Passo 2 — Criar o schema

1. No painel Supabase, vai a **SQL Editor**
2. Cola o conteúdo de `supabase/schema.sql`
3. Clica **Run**

---

## Passo 3 — Configurar variáveis de ambiente

Cria um ficheiro `.env.local` na raiz do projecto:

```bash
cp .env.example .env.local
# Preenche os valores de NEXT_PUBLIC_SUPABASE_URL, etc.
```

---

## Passo 4 — Migrar dados existentes do MongoDB (opcional)

Se tiveres dados no MongoDB que queres migrar, corre este script:

```bash
# Instala dependências necessárias
npm install mongodb

# Corre a migração
node scripts/migrate-mongo-to-supabase.mjs
```

> O script lê o `MONGODB_URI` e o `SUPABASE_*` do `.env.local`.

---

## Passo 5 — Adicionar autenticação (próximo passo)

O schema já tem RLS configurado e o trigger `on_auth_user_created`
cria automaticamente o perfil quando um utilizador se regista.

Para activar login na app, adiciona o componente de auth do Supabase:

```bash
npm install @supabase/auth-ui-react @supabase/auth-ui-shared
```

Até lá, podes usar um `userId` fixo (ex: UUID gerado no primeiro acesso
e guardado em `localStorage`) para testes sem login.

---

## Arquitectura de persistência

```
UI (page.tsx)
  │
  ├── executeToolAction()  ←── IA chama uma tool
  │     │
  │     └── persistAction(userId, action, payload)
  │           │
  │           ├── localStorage (imediato, offline)
  │           └── POST /api/state  (background, DB)
  │
  └── loadState(userId)
        │
        ├── GET /api/state?userId=xxx  (DB, ao iniciar)
        └── localStorage (fallback offline)
```

---

## Diferença chave: operações atómicas vs blob

**Antes:**
```json
POST /api/state
{ "state": { /* JSON completo de 50KB */ } }
```
→ Sobrescreve tudo, perde dados em conflitos

**Depois:**
```json
POST /api/state
{ "userId": "...", "action": "insert_transaction", "payload": { "transaction": {...} } }
```
→ Só altera o que mudou, seguro para múltiplos dispositivos
