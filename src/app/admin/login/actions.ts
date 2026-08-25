"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(_prevState: { error: string | null }, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/admin");

  if (!email || !password) {
    return { error: "Введите email и пароль" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Неверный email или пароль" };
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    return { error: "У этого аккаунта нет доступа к админ-панели" };
  }

  redirect(redirectTo || "/admin");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
