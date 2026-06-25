/**
 * Utilitários de autenticação para API Routes (server-side)
 * Valida a sessão via cookie e devolve o userId autenticado.
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get:    (name) => cookieStore.get(name)?.value,
          set:    (name, value, options: CookieOptions) => { try { cookieStore.set({ name, value, ...options }); } catch {} },
          remove: (name, options: CookieOptions) => { try { cookieStore.set({ name, value: "", ...options }); } catch {} },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}
