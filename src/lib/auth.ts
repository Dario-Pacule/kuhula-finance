"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

function makeSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get:    (name) => cookieStore.get(name)?.value,
        set:    (name, value, options: CookieOptions) => cookieStore.set({ name, value, ...options }),
        remove: (name, options: CookieOptions) => cookieStore.set({ name, value: "", ...options }),
      },
    }
  );
}

export async function login(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = makeSupabase(cookieStore);

  const email    = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/");
}

export async function register(formData: FormData) {
  const cookieStore = await cookies();
  const supabase = makeSupabase(cookieStore);

  const email       = formData.get("email") as string;
  const password    = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
    },
  });

  if (error) return { error: error.message };

  return { success: "Verifica o teu e-mail para confirmar o registo." };
}

export async function logout() {
  const cookieStore = await cookies();
  const supabase = makeSupabase(cookieStore);
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getUser() {
  const cookieStore = await cookies();
  const supabase = makeSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
