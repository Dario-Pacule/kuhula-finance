/**
 * Middleware de autenticação — Edge Runtime
 *
 * IMPORTANTE: O Edge Runtime não suporta DNS lookups nativos do Node.js,
 * por isso NÃO podemos chamar supabase.auth.getUser() aqui.
 *
 * Estratégia: verificar a existência do cookie de sessão do Supabase.
 * A validação real da sessão acontece nas API routes (Node.js runtime).
 *
 * O cookie sb-*-auth-token é criado pelo Supabase SSR após login bem-sucedido.
 * Se não existir, o utilizador não está autenticado.
 */

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm"];

// Prefixo do cookie de sessão do Supabase SSR
// Formato: sb-<project-ref>-auth-token
const SUPABASE_PROJECT_REF = "qyzyjvixqlsocqbbljup";
const SESSION_COOKIE = `sb-${SUPABASE_PROJECT_REF}-auth-token`;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rotas públicas e assets — deixar passar sempre
  if (
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  // Verificar cookie de sessão — sem chamada de rede
  const sessionCookie =
    request.cookies.get(SESSION_COOKIE) ||
    request.cookies.get(`${SESSION_COOKIE}.0`); // chunked cookie

  if (!sessionCookie?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
