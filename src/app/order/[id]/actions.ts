"use server";

import { createAdminClient } from "@/lib/supabase/admin";

// Опрашивается со страницы отслеживания раз в несколько секунд — только
// минимум полей, без прочих данных заказа (телефон, адрес и т.п.), даже
// хотя доступ и так только по неугадываемому id.
export async function getOrderTrackingState(
  id: string,
): Promise<{ status: string; sentAt: string | null } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("status, sent_at").eq("id", id).maybeSingle();
  if (!data) return null;
  return { status: data.status, sentAt: data.sent_at };
}
