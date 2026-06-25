import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema:    "./src/db/schema.ts",
  out:       "./src/db/migrations",
  dialect:   "postgresql",
  dbCredentials: {
    // Usado só localmente para gerar migrations (npx drizzle-kit generate)
    // Em produção as migrations correm via migrate.ts com a env var
    url: process.env.DATABASE_URL ?? "postgresql://localhost/kuhula",
  },
  // Não gerir RLS — deixamos isso para o Supabase
  verbose: true,
  strict:  false,
});
