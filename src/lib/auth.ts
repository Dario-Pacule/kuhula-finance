"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase";

async function makeClient() {
  const cookieStore = await cookies();
  return createServerClient(cookieStore);
}

export async function login(formData: FormData) {
  const supabase = await makeClient();
  const { error } = await supabase.auth.signInWithPassword({
    email:    formData.get("email") as string,
    password: formData.get("password") as string,
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function register(formData: FormData) {
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
