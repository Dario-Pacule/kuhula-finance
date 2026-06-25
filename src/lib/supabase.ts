/**
 * Supabase clients
 *
 * - createBrowserClient  → componentes client-side ("use client")
 * - createServerClient   → Server Components, API Routes, middleware
 * - supabaseAdmin        → operações admin server-side (service role)
 */

import { createBrowserClient as _createBrowserClient } from "@supabase/ssr";
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser (client components) ───────────────────────────────
export function createBrowserClient() {
  return _createBrowserClient(url, anon);
}

// ── Server (API routes / Server Components) ───────────────────
// Recebe os cookies do Next.js para manter sessão SSR.
export function createServerClient(cookieStore: {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  delete(name: string, options: CookieOptions): void;
}) {
  return _createServerClient(url, anon, {
    cookies: {
      get:    (name) => cookieStore.get(name)?.value,
      set:    (name, value, options) => { try { cookieStore.set(name, value, options); } catch {} },
      remove: (name, options) => { try { cookieStore.delete(name, options); } catch {} },
    },
  });
}

// ── Admin (service role — nunca expor no browser) ─────────────
export const supabaseAdmin = createClient(
  url,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon,
  { auth: { persistSession: false } }
);

// ── Legacy export (compatibilidade) ──────────────────────────
export const supabase = createBrowserClient();
