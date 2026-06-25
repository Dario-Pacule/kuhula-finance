/**
 * Kuhula Finance — Migration Runner
 *
 * Corre todas as migrations pendentes no arranque do servidor.
 * Usa uma tabela de controlo (kuhula_migrations) para rastrear
 * o que já foi executado — seguro para re-executar.
 *
 * Não requer CLI — corre programaticamente via postgres driver.
 */

import { readdir, readFile } from "fs/promises";
import path from "path";
import postgres from "postgres";

// ── Conexão ───────────────────────────────────────────────────
// Supabase expõe a conexão directa via DATABASE_URL ou
// construída a partir das variáveis individuais.

function getConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  // Supabase: construir a partir do URL do projecto
  // Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("DATABASE_URL ou NEXT_PUBLIC_SUPABASE_URL é obrigatório para migrations");

  // Extrai o ref do projecto do URL do Supabase
  // https://xxxxxxxxxxxx.supabase.co → xxxxxxxxxxxx
  const ref = url.replace("https://", "").split(".")[0];

  // Usa o direct connection (não pooler) para DDL
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;
  if (!dbPassword) {
    throw new Error(
      "SUPABASE_DB_PASSWORD é obrigatório para migrations. " +
      "Encontra em: Supabase Dashboard → Settings → Database → Connection string"
    );
  }

  return `postgresql://postgres.${ref}:${dbPassword}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`;
}

// ── Runner ────────────────────────────────────────────────────

export async function runMigrations() {
  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const connectionString = getConnectionString();
    sql = postgres(connectionString, {
      max: 1,
      connect_timeout: 15,
      ssl: "require",
      // Necessário para o pooler de transacções do Supabase (porta 6543)
      // que não suporta prepared statements
      prepare: false,
    });

    // Tabela de controlo de migrations
    await sql`
      create table if not exists public.kuhula_migrations (
        id         serial primary key,
        filename   text not null unique,
        applied_at timestamptz not null default now()
      )
    `;

    // Ler migrations aplicadas
    const applied = await sql`select filename from public.kuhula_migrations`;
    const appliedSet = new Set(applied.map((r: any) => r.filename));

    // Ler ficheiros de migration
    const migrationsDir = path.join(process.cwd(), "src/db/migrations");
    let files: string[] = [];
    try {
      files = (await readdir(migrationsDir))
        .filter(f => f.endsWith(".sql"))
        .sort(); // ordem alfabética garante ordem correcta
    } catch {
      console.log("[migrations] Pasta de migrations não encontrada — a ignorar");
      return;
    }

    const pending = files.filter(f => !appliedSet.has(f));

    if (pending.length === 0) {
      console.log("[migrations] Todas as migrations já aplicadas");
      return;
    }

    console.log(`[migrations] ${pending.length} migration(s) pendente(s):`, pending);

    for (const filename of pending) {
      const filePath = path.join(migrationsDir, filename);
      const sqlContent = await readFile(filePath, "utf-8");

      console.log(`[migrations] A aplicar: ${filename}`);

      // Executa todo o SQL de uma vez (suporta múltiplos statements)
      await sql.unsafe(sqlContent);

      // Regista como aplicada
      await sql`
        insert into public.kuhula_migrations (filename)
        values (${filename})
        on conflict (filename) do nothing
      `;

      console.log(`[migrations] ✓ ${filename} aplicada`);
    }

    console.log("[migrations] Todas as migrations aplicadas com sucesso");
  } catch (err: any) {
    // Migrations falhadas não devem bloquear o arranque da app
    // mas devem ser claramente visíveis nos logs
    console.error("[migrations] ERRO:", err.message ?? err);
    if (err.message?.includes("SUPABASE_DB_PASSWORD")) {
      console.error(
        "[migrations] Adiciona SUPABASE_DB_PASSWORD às variáveis de ambiente.\n" +
        "Encontra em: Supabase Dashboard → Settings → Database → Connection string (Direct)"
      );
    }
  } finally {
    if (sql) await sql.end();
  }
}
