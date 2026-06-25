"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@/lib/supabase";

function checkSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || url.includes("placeholder-url") || url.includes("xxxxxxxxxxxx")) {
    return {
      error: "O Supabase não está configurado. Por favor, configura as chaves de API (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY) no teu ficheiro .env.local."
    };
  }
  return null;
}

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(cookieStore);
}

export async function login(formData: FormData) {
  const configError = checkSupabaseConfig();
  if (configError) return configError;

  const supabase = await makeClient();
  const { error } = await supabase.auth.signInWithPassword({
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function register(formData: FormData) {
  const configError = checkSupabaseConfig();
  if (configError) return configError;

  const supabase = await makeClient();
  const { error } = await supabase.auth.signUp({
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: { display_name: formData.get("displayName") as string },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/auth/callback`,
    },
  });
  if (error) return { error: error.message };
  return { success: "Verifica o teu e-mail para confirmar o registo." };
}

export async function logout() {
  const supabase = await makeClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getUser() {
  const supabase = await makeClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function recoverPassword(formData: FormData) {
  const configError = checkSupabaseConfig();
  if (configError) return configError;

  const supabase = await makeClient();
  const email = formData.get("email") as string;
  
  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/login?reset=true`,
  });

  if (error) return { error: error.message };
  return { success: "Verifica o teu e-mail para obteres o link de recuperação." };
}

export async function updatePassword(formData: FormData) {
  const configError = checkSupabaseConfig();
  if (configError) return configError;

  const supabase = await makeClient();
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };
  return { success: "A tua palavra-passe foi atualizada com sucesso!" };
}
