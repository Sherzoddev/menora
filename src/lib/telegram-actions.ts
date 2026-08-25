"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTelegramBotInfo, setTelegramWebhook, setChatMenuButton } from "@/lib/telegram";

export async function setVenueBotToken(
  venueId: string,
  _prevState: { error: string | null; ok?: boolean },
  formData: FormData,
) {
  const token = String(formData.get("bot_token") ?? "").trim();
  if (!token) return { error: "Вставьте токен бота" };

  try {
    const botInfo = await getTelegramBotInfo(token);
    if (!botInfo) return { error: "Не удалось проверить токен — убедитесь, что скопировали его полностью" };

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const webhookResult = await setTelegramWebhook(token, `${siteUrl}/api/telegram/webhook/${venueId}`);
    if (!webhookResult.ok) {
      return { error: `Telegram отклонил webhook: ${webhookResult.description ?? "неизвестная ошибка"}` };
    }

    const supabase = await createClient();
    const { data: venue } = await supabase.from("venues").select("slug").eq("id", venueId).single();
    if (venue?.slug) {
      // Persistent "Menu" button next to the message input, for every chat —
      // opens the Mini App instantly instead of relying on a message with a
      // button that scrolls out of view (see customerReplyMarkup for the
      // reply-keyboard fallback inside an actual conversation).
      await setChatMenuButton(token, `${siteUrl}/${venue.slug}`);
    }

    const { error } = await supabase
      .from("venues")
      .update({ telegram_bot_token: token, telegram_bot_username: botInfo.username, telegram_chat_id: null })
      .eq("id", venueId);

    if (error) return { error: error.message };

    revalidatePath(`/admin/venues/${venueId}`);
    revalidatePath("/cabinet/info");
    return { error: null, ok: true, botUsername: botInfo.username };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Ошибка: ${message}` };
  }
}

export async function disconnectVenueBot(venueId: string) {
  const supabase = await createClient();
  await supabase
    .from("venues")
    .update({ telegram_bot_token: null, telegram_bot_username: null, telegram_chat_id: null })
    .eq("id", venueId);
  revalidatePath(`/admin/venues/${venueId}`);
  revalidatePath("/cabinet/info");
}
