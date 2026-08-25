// Персонал заведения в его собственном Telegram-боте — не один-единственный
// telegram_chat_id (как было раньше), а список: venue_staff. Добавление —
// по chat_id, той же схемой, что и в MENORA_ADMIN-боте (bot_admins): новый
// человек присылает боту секретную фразу заведения (venues.staff_invite_code)
// и сам попадает в список, без вмешательства владельца или разработчика.
//
// venues.telegram_chat_id остаётся как "первый/основной" — на него по-прежнему
// смотрит логика первого /start (см. webhook/[venueId]/route.ts), но
// уведомления теперь уходят всем: и основному, и всем из venue_staff.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, sendTelegramPhoto, type TgMarkup } from "@/lib/telegram";

export async function fetchStaffChatIds(venueId: string, primaryChatId: number | null): Promise<number[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("venue_staff").select("chat_id").eq("venue_id", venueId);
  const ids = new Set<number>((data ?? []).map((r) => r.chat_id));
  if (primaryChatId) ids.add(primaryChatId);
  return [...ids];
}

export async function notifyStaff(
  botToken: string,
  venueId: string,
  primaryChatId: number | null,
  text: string,
  markup?: TgMarkup,
): Promise<void> {
  const ids = await fetchStaffChatIds(venueId, primaryChatId);
  for (const chatId of ids) {
    await sendTelegramMessage(botToken, chatId, text, markup);
  }
}

export async function notifyStaffPhoto(
  botToken: string,
  venueId: string,
  primaryChatId: number | null,
  photoUrl: string,
  caption: string,
  markup?: TgMarkup,
): Promise<void> {
  const ids = await fetchStaffChatIds(venueId, primaryChatId);
  for (const chatId of ids) {
    await sendTelegramPhoto(botToken, chatId, photoUrl, caption, markup);
  }
}
