/**
 * Next.js Instrumentation Hook
 *
 * Corre uma vez no arranque do servidor (não no browser).
 * Usa para executar migrations de DB antes de qualquer request.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Só corre no servidor Node.js, não no Edge runtime nem no browser
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runMigrations } = await import("./src/db/migrate");
    await runMigrations();
  }
}
