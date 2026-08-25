"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";

export async function broadcastToCustomers(
  venueId: string,
  _prevState: { error: string | null; ok?: boolean; count?: number },
  formData: FormData,
) {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) return { error: "Введите текст сообщения" };

  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("telegram_bot_token").eq("id", venueId).single();
  if (!venue?.telegram_bot_token) return { error: "Бот не подключён" };

  const adminDb = createAdminClient();
  const { data: customers } = await adminDb.from("telegram_customers").select("chat_id").eq("venue_id", venueId);
  if (!customers?.length) return { error: "Пока нет клиентов, которые открывали бота" };

  for (const c of customers) {
    await sendTelegramMessage(venue.telegram_bot_token, c.chat_id, message);
    await adminDb.from("notifications").insert({ venue_id: venueId, type: "broadcast", status: "sent" });
    // Stay comfortably under Telegram's ~30 msg/sec global rate limit.
    await new Promise((r) => setTimeout(r, 40));
  }

  return { error: null, ok: true, count: customers.length };
}
