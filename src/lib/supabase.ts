/**
 * Supabase clients
 *
 * @supabase/ssr v0.12+ usa getAll/setAll em vez de get/set/remove
 */

import { createBrowserClient as _createBrowserClient, createServerClient as _createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ── Browser (client components) ───────────────────────────────
export function createBrowserClient() {
  return _createBrowserClient(url, anon);
}

// ── Server — para API routes e Server Components ──────────────
// Recebe o ReadonlyRequestCookies do Next.js (cookies())
export function createServerClient(cookieStore: {
  getAll(): { name: string; value: string }[];
  set(cookie: { name: string; value: string; [key: string]: any }): void;
}) {
  return _createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookies) => {
        try {
          cookies.forEach(({ name, value, options }) =>
            cookieStore.set({ name, value, ...options })
          );
        } catch {}
      },
    },
  });
}

// ── Middleware — precisa ler request E escrever response ───────
export function createMiddlewareClient(
  request: NextRequest,
  response: NextResponse
) {
  return _createServerClient(url, anon, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options })
        );
      },
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
