"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_VENUE_COOKIE } from "@/lib/cabinet";

export async function switchVenue(formData: FormData) {
  const venueId = String(formData.get("venueId") ?? "");
  if (!venueId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/cabinet/login");

  // Не доверяем venueId из формы напрямую — переключаем только на
  // заведение, которое реально принадлежит текущему owner'у.
  const { data: ownerRow } = await supabase
    .from("venue_users")
    .select("id")
    .eq("user_id", user.id)
    .eq("venue_id", venueId)
    .maybeSingle();
  if (!ownerRow) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_VENUE_COOKIE, venueId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  redirect("/cabinet");
}
