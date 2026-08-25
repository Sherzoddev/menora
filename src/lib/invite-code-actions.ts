"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids typos

function generateCode(length = 8) {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export async function createInviteCode(venueId: string) {
  const supabase = await createClient();
  let code = "";
  // retry on the (very unlikely) chance of a collision with the unique constraint
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { error } = await supabase.from("venue_invite_codes").insert({ venue_id: venueId, code });
    if (!error) break;
    if (error.code !== "23505") throw new Error(error.message);
  }

  revalidatePath(`/admin/venues/${venueId}`);
  return { code };
}

export async function deleteInviteCode(venueId: string, codeId: string) {
  const supabase = await createClient();
  await supabase.from("venue_invite_codes").delete().eq("id", codeId);
  revalidatePath(`/admin/venues/${venueId}`);
}

export async function activateInviteCode(
  _prevState: { error: string | null },
  formData: FormData,
) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!code) return { error: "Введите код активации" };
  if (!email) return { error: "Введите email" };
  if (password.length < 6) return { error: "Пароль должен быть не короче 6 символов" };

  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("venue_invite_codes")
    .select("id, venue_id, used_at")
    .eq("code", code)
    .maybeSingle();

  if (!invite) return { error: "Код не найден — проверьте, что ввели его без ошибок" };
  if (invite.used_at) return { error: "Этот код уже был использован" };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (/already registered|already exists/i.test(createError.message)) {
      return { error: "Этот email уже зарегистрирован — войдите обычным способом или используйте другой email" };
    }
    return { error: createError.message };
  }

  const userId = created.user?.id;
  if (!userId) return { error: "Не удалось создать аккаунт" };

  const { error: linkError } = await admin
    .from("venue_users")
    .insert({ venue_id: invite.venue_id, user_id: userId, email });

  if (linkError) {
    return { error: linkError.message };
  }

  await admin
    .from("venue_invite_codes")
    .update({ used_at: new Date().toISOString(), used_by: userId })
    .eq("id", invite.id);

  redirect("/cabinet/login?activated=1");
}
