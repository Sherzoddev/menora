// Единая точка смены стадии заказа — раньше "готово" (status) и "отправлено"
// (отдельное поле sent_at) жили порознь и обновлялись в двух разных местах
// (бот и кабинет) каждый по-своему. Теперь и бот, и кабинет дёргают одну
// функцию.
//
// Гостю в Telegram, если известен его chat_id (заказ оформлен через Mini
// App — см. verifyTelegramInitData в orders-actions.ts), отправляется ОДНО
// сообщение-трекер сразу при создании заказа (sendOrderTracker), а при
// каждой смене стадии оно же редактируется на месте (editMessageText) —
// тот же принцип, что уже используется для карточки заказа у персонала
// (см. webhook/[venueId]/route.ts), только теперь и у гостя стадии видно
// прямо в чате, а не только на странице /order/[id]. Если исходное
// сообщение почему-то не отправилось (старый заказ без сохранённого
// message_id, или Telegram был недоступен) — откатываемся на обычный push.
//
// При переходе в "sent" ещё и планируется запрос отзыва через 30 минут
// (send_due_rating_requests() pg_cron job, уже настроен).

import { createAdminClient } from "@/lib/supabase/admin";
import { sendTelegramMessage, editTelegramMessage, type TgMarkup } from "@/lib/telegram";
import { BOT_TEXT, resolveBotLang, type BotLang } from "@/lib/bot-i18n";

export type OrderStatus = "new" | "preparing" | "ready" | "sent";

const RATING_REQUEST_DELAY_MS = 30 * 60 * 1000;

const STAGE_ORDER: OrderStatus[] = ["new", "preparing", "ready", "sent"];

function renderTrackerText(params: {
  status: OrderStatus;
  lang: BotLang;
  venueName: string;
  orderNumber: number;
  fulfillment: string;
}): string {
  const { status, lang, venueName, orderNumber, fulfillment } = params;
  const t = BOT_TEXT[lang];
  const stageIndex = STAGE_ORDER.indexOf(status);

  const lines = STAGE_ORDER.map((stage, i) => {
    const label = t.status[stage];
    if (i < stageIndex) return `✅ ${label}`;
    if (i === stageIndex) return `▶️ <b>${label}</b>`;
    return `◻️ ${label}`;
  });

  const courierNote = status === "sent" && fulfillment === "delivery" ? `\n\n${t.trackerCourierNote}` : "";

  return `${t.trackerHeader(venueName, orderNumber)}\n\n${lines.join("\n")}${courierNote}`;
}

function trackerMarkup(orderId: string, lang: BotLang): TgMarkup {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { inline_keyboard: [[{ text: BOT_TEXT[lang].trackerButton, url: `${siteUrl}/order/${orderId}` }]] };
}

/**
 * Отправляет начальный трекер-статус гостю сразу после оформления заказа
 * (стадия "new") и запоминает id сообщения для будущих правок. Best-effort —
 * само создание заказа не должно зависеть от доступности Telegram.
 */
export async function sendOrderTracker(params: {
  venueId: string;
  orderId: string;
  chatId: number;
  botToken: string;
  venueName: string;
  orderNumber: number;
  fulfillment: string;
  lang: BotLang;
}): Promise<void> {
  const { orderId, chatId, botToken, venueName, orderNumber, fulfillment, lang } = params;
  const text = renderTrackerText({ status: "new", lang, venueName, orderNumber, fulfillment });
  const sent = await sendTelegramMessage(botToken, chatId, text, trackerMarkup(orderId, lang));
  if (!sent) return;

  await createAdminClient()
    .from("orders")
    .update({ customer_tracker_message_id: sent.message_id })
    .eq("id", orderId);
}

export async function advanceOrderStatus(params: {
  venueId: string;
  orderId: string;
  status: OrderStatus;
}): Promise<void> {
  const { venueId, orderId, status } = params;
  const admin = createAdminClient();

  const updates: { status: OrderStatus; sent_at?: string } = { status };
  if (status === "sent") updates.sent_at = new Date().toISOString();

  const { data: order } = await admin
    .from("orders")
    .update(updates)
    .eq("id", orderId)
    .select("customer_telegram_chat_id, customer_tracker_message_id, order_number, fulfillment")
    .single();

  if (!order?.customer_telegram_chat_id) return;

  const { data: venue } = await admin.from("venues").select("name, telegram_bot_token").eq("id", venueId).single();
  if (!venue?.telegram_bot_token) return;

  const { data: customerRow } = await admin
    .from("telegram_customers")
    .select("language")
    .eq("venue_id", venueId)
    .eq("chat_id", order.customer_telegram_chat_id)
    .maybeSingle();
  const lang = resolveBotLang(customerRow?.language);

  const text = renderTrackerText({
    status,
    lang,
    venueName: venue.name,
    orderNumber: order.order_number,
    fulfillment: order.fulfillment,
  });
  const markup = trackerMarkup(orderId, lang);

  if (order.customer_tracker_message_id) {
    await editTelegramMessage(venue.telegram_bot_token, order.customer_telegram_chat_id, order.customer_tracker_message_id, text, markup);
  } else {
    await sendTelegramMessage(venue.telegram_bot_token, order.customer_telegram_chat_id, text, markup);
  }

  if (status === "sent") {
    await admin.from("rating_requests").upsert(
      {
        order_id: orderId,
        venue_id: venueId,
        telegram_chat_id: order.customer_telegram_chat_id,
        send_after: new Date(Date.now() + RATING_REQUEST_DELAY_MS).toISOString(),
      },
      { onConflict: "order_id" },
    );
  }
}
