import type { TgMarkup } from "./telegram";
import { BOT_TEXT, STAFF_TEXT, FEEDBACK_TAG_KEYS, LANGUAGE_NAMES, feedbackTagLabel, type BotLang } from "./bot-i18n";

// Fixed table range for the bot's "Столы"/"Stollar" menu — matches how
// venues currently number their tables when generating table QR codes. Not
// per-venue configurable yet; bump this if a venue needs more than 15 tables.
export const BOT_TABLE_COUNT = 15;

// Persistent bottom keyboard — always visible, independent of any single
// message, so staff never have to scroll back to find the menu. "Кабинет"
// opens the full owner dashboard as a Mini App (web_app) — everything the
// site can do, without leaving Telegram.
export function mainReplyMarkup(siteUrl: string, lang: BotLang): TgMarkup {
  const labels = STAFF_TEXT[lang].labels;
  return {
    keyboard: [
      [{ text: labels.tables }, { text: labels.delivery }],
      [{ text: labels.prices }, { text: labels.stats }],
      [{ text: labels.cabinet, web_app: { url: `${siteUrl}/cabinet` } }, { text: labels.invite }],
      [{ text: labels.radius }, { text: labels.language }],
    ],
    resize_keyboard: true,
  };
}

// Telegram doesn't support custom button colors on inline keyboards — 🟢/⚪
// prefixes are the closest equivalent, so staff can spot which tables have a
// waiting order without opening all 15.
export function tablesMarkup(activeTables: Set<string>, lang: BotLang): TgMarkup {
  const perRow = 5;
  const rows = [];
  for (let i = 1; i <= BOT_TABLE_COUNT; i += perRow) {
    const row = [];
    for (let n = i; n < i + perRow && n <= BOT_TABLE_COUNT; n++) {
      const dot = activeTables.has(String(n)) ? "🟢" : "⚪";
      row.push({ text: `${dot} ${n}`, callback_data: `table|${n}` });
    }
    rows.push(row);
  }
  rows.push([{ text: STAFF_TEXT[lang].tables.backButton, callback_data: "close" }]);
  return { inline_keyboard: rows };
}

export function backOnlyMarkup(callbackData: string, lang: BotLang): TgMarkup {
  return { inline_keyboard: [[{ text: STAFF_TEXT[lang].tables.backButton, callback_data: callbackData }]] };
}

export function emptyMarkup(): TgMarkup {
  return { inline_keyboard: [] };
}

// Один заказ — одна кнопка на следующий шаг цепочки (не сразу "готово"):
// принят -> готовится -> готов -> отправлен. "sent" — конечная стадия,
// кнопки для неё уже нет. context — "delivery" или "table|<n>", тот же,
// что раньше был в "done" — определяет и callback, и куда вернёт "Назад".
export function stageButtonFor(
  status: string,
  lang: BotLang,
): { label: string; nextStatus: string } | null {
  const t = STAFF_TEXT[lang].stages;
  if (status === "new") return { label: t.startCookingButton, nextStatus: "preparing" };
  if (status === "preparing") return { label: t.readyButton, nextStatus: "ready" };
  if (status === "ready") return { label: t.sentButton, nextStatus: "sent" };
  return null;
}

export function orderActionsMarkup(orderId: string, status: string, context: string, lang: BotLang): TgMarkup {
  const backTarget = context.startsWith("table|") ? "tables" : "close";
  const next = stageButtonFor(status, lang);
  const rows: { text: string; callback_data: string }[][] = [];
  if (next) rows.push([{ text: next.label, callback_data: `stage|${orderId}|${next.nextStatus}|${context}` }]);
  rows.push([{ text: STAFF_TEXT[lang].tables.backButton, callback_data: backTarget }]);
  return { inline_keyboard: rows };
}

export function priceCategoriesMarkup(categories: { id: string; name: string }[]): TgMarkup {
  return { inline_keyboard: categories.map((c) => [{ text: c.name, callback_data: `pricecat|${c.id}` }]) };
}

// priceLabel comes pre-formatted (formatPrice) from the caller — keeps this
// file free of a menu-utils dependency, matching its existing minimal style.
export function priceDishesMarkup(dishes: { id: string; name: string; priceLabel: string }[], lang: BotLang): TgMarkup {
  const rows = dishes.map((d) => [{ text: `${d.name} — ${d.priceLabel}`, callback_data: `editprice|${d.id}` }]);
  rows.push([{ text: STAFF_TEXT[lang].tables.backButton, callback_data: "pricecats" }]);
  return { inline_keyboard: rows };
}

// Shown after staff taps "📍 Радиус доставки" and the venue already has
// coordinates saved (asks for location first otherwise — see webhook).
// "0" is the sentinel for "no limit" (delivery_radius_km = null).
export function radiusPickerMarkup(lang: BotLang): TgMarkup {
  const t = STAFF_TEXT[lang].radius;
  return {
    inline_keyboard: [
      [10, 20, 30, 40].map((km) => ({ text: `${km} км`, callback_data: `setradius|${km}` })),
      [{ text: t.customButton, callback_data: "setradius|custom" }],
      [{ text: t.unlimitedLabel, callback_data: "setradius|0" }],
      [{ text: t.relocateButton, callback_data: "setradius|relocate" }],
      [{ text: STAFF_TEXT[lang].tables.backButton, callback_data: "close" }],
    ],
  };
}

// Shown any time staff taps "🌐 Язык"/"Til".
export function staffLanguagePickerMarkup(): TgMarkup {
  return {
    inline_keyboard: [
      [
        { text: LANGUAGE_NAMES.ru, callback_data: "setstafflang|ru" },
        { text: LANGUAGE_NAMES.uz, callback_data: "setstafflang|uz" },
      ],
    ],
  };
}

// Sent to anyone who opens a venue's bot who *isn't* the staff chat bound in
// venues.telegram_chat_id — i.e. a customer. Persistent, like mainReplyMarkup
// for staff, so the bot reads as a mini-app rather than a one-shot button
// that scrolls out of view. The "Меню"/"Menyu" button has type web_app, so
// tapping it opens the existing public menu inside Telegram's WebView
// directly (no separate Mini App build — see src/lib/telegram-init-data.ts
// for how checkout authenticates the Telegram identity this hands back);
// the rest are plain text buttons handled in the webhook route.
// `table`, when known (customer scanned a table's QR and chose Telegram —
// see the /scan choice page and the /start `table_N` deep-link payload),
// keeps opening the Mini App pre-scoped to that table on every message,
// not just the first one.
export function customerReplyMarkup(slug: string, siteUrl: string, lang: BotLang, table?: string): TgMarkup {
  const labels = BOT_TEXT[lang].labels;
  const menuUrl = `${siteUrl}/${slug}${table ? `?table=${encodeURIComponent(table)}` : ""}`;
  return {
    keyboard: [
      [{ text: labels.menu, web_app: { url: menuUrl } }],
      [{ text: labels.orders }, { text: labels.bonuses }],
      [{ text: labels.contacts }, { text: labels.language }],
    ],
    resize_keyboard: true,
  };
}

// Shown on a brand-new customer's very first /start (before any welcome
// message — see the webhook), and again any time they tap "🌐 Язык"/"Til".
export function languagePickerMarkup(): TgMarkup {
  return {
    inline_keyboard: [
      [
        { text: LANGUAGE_NAMES.ru, callback_data: "setlang|ru" },
        { text: LANGUAGE_NAMES.uz, callback_data: "setlang|uz" },
      ],
    ],
  };
}

export function ratingMarkup(orderId: string): TgMarkup {
  return {
    inline_keyboard: [
      [1, 2, 3, 4, 5].map((n) => ({ text: `⭐ ${n}`, callback_data: `rate|${orderId}|${n}` })),
    ],
  };
}

// Shown only after a low (1-3⭐) rating, to collect a quick reason without
// requiring free-text input (never made mandatory, per spec). callback_data
// carries the canonical (ASCII) key, not the translated label — the stored
// rating tag is always the Russian label regardless of the customer's
// language, since the owner's Reviews page is Russian-only.
export function feedbackTagsMarkup(orderId: string, lang: BotLang): TgMarkup {
  return {
    inline_keyboard: FEEDBACK_TAG_KEYS.map((key) => [
      { text: feedbackTagLabel(lang, key), callback_data: `tag|${orderId}|${key}` },
    ]),
  };
}
