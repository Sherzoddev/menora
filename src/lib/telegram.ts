const API_BASE = "https://api.telegram.org";

// Raw Telegram reply_markup payload — either an inline keyboard (buttons
// attached under one message, drive callback_query updates) or a persistent
// reply keyboard (replaces the user's normal keyboard, drives plain text
// messages). Built by the helpers in ./telegram-keyboard.
export type TgMarkup = Record<string, unknown>;

// Returns the sent message's id (so callers can later editMessageText it —
// see the customer order tracker in lib/order-status.ts) or null on any
// failure. Still best-effort: never throws, since a failed Telegram send
// must not break order creation.
export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: TgMarkup,
): Promise<{ message_id: number } | null> {
  try {
    const res = await fetch(`${API_BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    const data = await res.json();
    return data.ok ? { message_id: data.result.message_id as number } : null;
  } catch {
    return null;
  }
}

export async function editTelegramMessage(
  botToken: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: TgMarkup,
) {
  await fetch(`${API_BASE}/bot${botToken}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "HTML",
      // editMessageText only ever supports inline keyboards — default to
      // clearing any buttons rather than leaving stale ones on screen.
      reply_markup: replyMarkup ?? { inline_keyboard: [] },
    }),
  }).catch(() => {});
}

export async function answerTelegramCallback(botToken: string, callbackQueryId: string, text?: string) {
  await fetch(`${API_BASE}/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}

export async function setTelegramWebhook(botToken: string, url: string) {
  const res = await fetch(`${API_BASE}/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function getTelegramBotInfo(botToken: string) {
  const res = await fetch(`${API_BASE}/bot${botToken}/getMe`);
  const data = await res.json();
  if (!data.ok) return null;
  return data.result as { id: number; username: string; first_name: string };
}

export async function sendTelegramPhoto(
  botToken: string,
  chatId: number,
  photoUrl: string,
  caption: string,
  replyMarkup?: TgMarkup,
) {
  await fetch(`${API_BASE}/bot${botToken}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  }).catch(() => {});
}

// A MenuButton set with no chatId becomes the bot-wide default — every
// chat gets the persistent "Menu" button next to the message input,
// opening the Mini App instantly instead of relying on a message with an
// inline/reply button scrolling out of view.
export async function setChatMenuButton(botToken: string, webAppUrl: string, chatId?: number) {
  await fetch(`${API_BASE}/bot${botToken}/setChatMenuButton`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(chatId ? { chat_id: chatId } : {}),
      menu_button: { type: "web_app", text: "Меню", web_app: { url: webAppUrl } },
    }),
  }).catch(() => {});
}
