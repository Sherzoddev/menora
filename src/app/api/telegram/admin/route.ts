import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importVeloraProducts, syncVeloraStock } from "@/lib/velora-actions";

// Импорт каталога теперь ещё и скачивает/заливает фото на каждый товар —
// на десятках позиций дефолтных 10с может не хватить.
export const maxDuration = 60;

/**
 * Бот-администратор Меноры — отдельный от per-venue гостевых ботов (у тех
 * свой токен на заведение, см. webhook/[venueId]). Этот один общий бот
 * работает только с доверенными чатами: гейтится на список ADMIN_CHAT_IDS
 * (MENORA_ADMIN_CHAT_ID — один ID или несколько через запятую), остальным
 * чатам не отвечает вообще (тихо игнорирует, чтобы не подсказывать чужим,
 * что бот что-то умеет).
 *
 * Пока 2 команды:
 *  - 🔗 Подключить Velora — привязать заведение Меноры к заведению/токену в
 *    Velora (кассе). Токен Velora выдаётся отдельно (см. shaurma/venue_tokens),
 *    сюда только вписывается — бот не умеет сам создавать токены в чужом
 *    проекте, у него нет туда доступа и не должно быть.
 *  - 📊 Статистика — заказы/выручка по заведению за сегодня/неделю/всё время.
 *
 * Состояние между шагами не храним в базе — как и owner-bot-gate в shaurma,
 * используем forceReply + сверку с текстом, на который отвечают
 * (reply_to_message): id заведения зашит прямо в текст подсказки.
 */

const BOT_TOKEN = process.env.MENORA_ADMIN_BOT_TOKEN;
// Один ID остаётся рабочим как раньше — просто список из одного элемента.
// Добавить помощника: MENORA_ADMIN_CHAT_ID=5178014529,987654321 (через запятую).
const ADMIN_CHAT_IDS = (process.env.MENORA_ADMIN_CHAT_ID ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WEBHOOK_SECRET = process.env.MENORA_ADMIN_WEBHOOK_SECRET;
const SETUP_TOKEN = process.env.MENORA_ADMIN_SETUP_TOKEN;
// Секретная фраза для самостоятельного добавления нового админа (см.
// handleInviteCodeMessage) — не путать с MENORA_ADMIN_SETUP_TOKEN (тот для
// настройки вебхука, не для выдачи доступа людям).
const ADMIN_INVITE_CODE = process.env.MENORA_ADMIN_INVITE_CODE;

const BTN_CONNECT = "🔗 Подключить Velora";
const BTN_IMPORT = "📥 Товары из Velora";
const BTN_SYNC_STOCK = "🔄 Обновить остатки";
const BTN_STATS = "📊 Статистика";
const BTN_MY_VENUES = "👥 Мои заведения";
const BTN_INVITE = "🎟 Инвайт-код";
const BTN_TOGGLE_ACCESS = "🔐 Вкл/выкл доступ";
const BTN_BROADCAST = "📢 Рассылка владельцам";
const BTN_ADMINS = "👤 Админы бота";

const MAIN_MARKUP = {
  keyboard: [
    [{ text: BTN_CONNECT }, { text: BTN_IMPORT }],
    [{ text: BTN_SYNC_STOCK }, { text: BTN_STATS }],
    [{ text: BTN_MY_VENUES }, { text: BTN_INVITE }],
    [{ text: BTN_TOGGLE_ACCESS }, { text: BTN_BROADCAST }],
    [{ text: BTN_ADMINS }],
  ],
  resize_keyboard: true,
};

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "";

async function tg(method: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

async function sendMessage(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackQueryId, text });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  velora_venue_id: string | null;
  velora_token: string | null;
};

async function fetchVenues(): Promise<VenueRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("id, name, slug, is_active, velora_venue_id, velora_token")
    .order("name");
  // Раньше при ошибке (неверный SUPABASE_SERVICE_ROLE_KEY и т.п.) молча
  // говорили "заведений нет" — не отличить от реально пустой базы. Кидаем
  // дальше, чтобы обработчик показал настоящую причину в чате.
  if (error) throw new Error(`venues: ${error.message}`);
  return data ?? [];
}

function venuePickerMarkup(venues: VenueRow[], prefix: string) {
  return {
    inline_keyboard: venues.map((v) => [
      { text: v.name + (prefix === "connect" && v.velora_venue_id ? " ✅" : ""), callback_data: `${prefix}:${v.id}` },
    ]),
  };
}

function toggleAccessMarkup(venues: VenueRow[]) {
  return {
    inline_keyboard: venues.map((v) => [
      { text: `${v.is_active ? "🟢" : "🔴"} ${v.name}`, callback_data: `toggle:${v.id}` },
    ]),
  };
}

const CONNECT_PROMPT_HEAD = "Подключение Velora";

async function handleConnectPick(chatId: string, venueId: string) {
  const supabase = createAdminClient();
  const { data: venue } = await supabase.from("venues").select("id, name").eq("id", venueId).single();
  if (!venue) return sendMessage(chatId, "Заведение не найдено.");

  await sendMessage(
    chatId,
    `${CONNECT_PROMPT_HEAD}: <b>${escapeHtml(venue.name)}</b>\nid: ${venue.id}\n\n` +
      `Пришлите токен заведения из Velora — venue_id бот найдёт сам.`,
    { reply_markup: { force_reply: true, selective: true } },
  );
}

/** Токен сам по себе не говорит, к какому заведению относится — спрашиваем
 * у самой Velora (GET /venues отдаёт ровно одну строку: заведение этого
 * токена), чтобы не заставлять вписывать venue_id руками. */
async function resolveVeloraVenue(token: string): Promise<{ id: string; name: string } | null> {
  const res = await fetch("https://qzhvtufjqaaeyzbycidf.supabase.co/rest/v1/venues?select=id,name&limit=1", {
    headers: {
      apikey: "sb_publishable_6QwVueO_5Wza0t8LJkakmA_AEswjAkP",
      Authorization: "Bearer sb_publishable_6QwVueO_5Wza0t8LJkakmA_AEswjAkP",
      "x-venue-token": token,
    },
  });
  if (!res.ok) return null;
  const rows: { id: string; name: string }[] = await res.json().catch(() => []);
  return rows[0] ?? null;
}

async function handleConnectReply(chatId: string, repliedTo: string, text: string) {
  const idMatch = repliedTo.match(/id: ([0-9a-f-]{36})/i);
  const menoraVenueId = idMatch?.[1];
  if (!menoraVenueId) return;

  const veloraToken = text.trim();
  if (veloraToken.length < 10) {
    await sendMessage(chatId, "Не похоже на токен — пришлите его ещё раз.");
    return;
  }

  const veloraVenue = await resolveVeloraVenue(veloraToken);
  if (!veloraVenue) {
    await sendMessage(chatId, "⚠️ Velora не узнала этот токен (неверный или отозван). Проверьте и пришлите заново.");
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("venues")
    .update({ velora_venue_id: veloraVenue.id, velora_token: veloraToken })
    .eq("id", menoraVenueId);

  if (error) {
    await sendMessage(chatId, `⚠️ Не сохранилось: ${escapeHtml(error.message)}`);
    return;
  }
  await sendMessage(
    chatId,
    `✅ Подключено к заведению Velora «${escapeHtml(veloraVenue.name)}» (venue_id: <code>${veloraVenue.id}</code>).\n` +
      `Новые заказы теперь будут открывать там счёт.`,
    { reply_markup: MAIN_MARKUP },
  );
}

async function handleImportPick(chatId: string, venueId: string) {
  const supabase = createAdminClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, velora_venue_id, velora_token")
    .eq("id", venueId)
    .single();
  if (!venue) return sendMessage(chatId, "Заведение не найдено.");
  if (!venue.velora_venue_id || !venue.velora_token) {
    await sendMessage(chatId, `Сначала подключите «${escapeHtml(venue.name)}» через ${BTN_CONNECT}.`);
    return;
  }

  await sendMessage(chatId, `Копирую товары из Velora в «${escapeHtml(venue.name)}»…`);
  const result = await importVeloraProducts({
    menoraVenueId: venue.id,
    veloraVenueId: venue.velora_venue_id,
    veloraToken: venue.velora_token,
  });
  await sendMessage(
    chatId,
    `✅ Готово.\nНовых блюд: ${result.createdDishes}\nОбновлено: ${result.updatedDishes}\nНовых категорий: ${result.createdCategories}\n\n` +
      `Проверьте цены/фото в админке — импорт переносит только название, цену и категорию.`,
    { reply_markup: MAIN_MARKUP },
  );
}

async function handleStatsPick(chatId: string, venueId: string) {
  const supabase = createAdminClient();
  const { data: venue } = await supabase.from("venues").select("id, name").eq("id", venueId).single();
  if (!venue) return sendMessage(chatId, "Заведение не найдено.");

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [{ data: today }, { data: week }, { count: allCount, data: allSample }] = await Promise.all([
    supabase.from("orders").select("total").eq("venue_id", venueId).gte("created_at", todayStart.toISOString()),
    supabase.from("orders").select("total").eq("venue_id", venueId).gte("created_at", weekStart.toISOString()),
    supabase.from("orders").select("total", { count: "exact" }).eq("venue_id", venueId),
  ]);

  const sum = (rows: { total: number }[] | null) => (rows ?? []).reduce((s, o) => s + o.total, 0);
  const allTotal = sum(allSample);

  const text =
    `📊 <b>${escapeHtml(venue.name)}</b>\n\n` +
    `Сегодня: ${today?.length ?? 0} заказ(ов), ${sum(today).toLocaleString("ru-RU")} сум\n` +
    `За 7 дней: ${week?.length ?? 0} заказ(ов), ${sum(week).toLocaleString("ru-RU")} сум\n` +
    `Всего за всё время: ${allCount ?? 0} заказ(ов), ${allTotal.toLocaleString("ru-RU")} сум`;

  await sendMessage(chatId, text);
}

async function handleMyVenues(chatId: string) {
  const venues = await fetchVenues();
  if (venues.length === 0) return void (await sendMessage(chatId, "Заведений пока нет."));

  const lines = venues.map((v) => {
    const status = v.is_active ? "🟢" : "🔴";
    const menuUrl = `${SITE_URL}/${v.slug}`;
    const adminUrl = `${SITE_URL}/admin/venues/${v.id}`;
    return `${status} <b>${escapeHtml(v.name)}</b>\nМеню: ${menuUrl}\nАдминка: ${adminUrl}`;
  });
  await sendMessage(chatId, lines.join("\n\n"));
}

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I/L — не спутать на глаз

function generateInviteCode(length = 8): string {
  let code = "";
  for (let i = 0; i < length; i++) code += INVITE_CODE_ALPHABET[Math.floor(Math.random() * INVITE_CODE_ALPHABET.length)];
  return code;
}

async function handleInvitePick(chatId: string, venueId: string) {
  const supabase = createAdminClient();
  const { data: venue } = await supabase.from("venues").select("id, name").eq("id", venueId).single();
  if (!venue) return sendMessage(chatId, "Заведение не найдено.");

  let code = "";
  let inserted = false;
  // На случай (маловероятного) совпадения с уже существующим кодом — как в
  // src/lib/invite-code-actions.ts, только здесь через service-role, а не
  // RLS-клиент (у бота нет Supabase Auth-сессии владельца).
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateInviteCode();
    const { error } = await supabase.from("venue_invite_codes").insert({ venue_id: venueId, code });
    if (!error) {
      inserted = true;
      break;
    }
    if (error.code !== "23505") throw new Error(error.message);
  }
  if (!inserted) return void (await sendMessage(chatId, "⚠️ Не удалось сгенерировать код, попробуйте ещё раз."));

  await sendMessage(
    chatId,
    `🎟 Код для «${escapeHtml(venue.name)}»: <code>${code}</code>\n\n` +
      `Отправьте владельцу вместе со ссылкой: ${SITE_URL}/cabinet/activate\n` +
      `Он введёт код и свой email/пароль — получит доступ только к своему кабинету.`,
    { reply_markup: MAIN_MARKUP },
  );
}

async function handleToggleAccessPick(chatId: string, venueId: string) {
  const supabase = createAdminClient();
  const { data: venue } = await supabase.from("venues").select("id, name, is_active").eq("id", venueId).single();
  if (!venue) return sendMessage(chatId, "Заведение не найдено.");

  const nextActive = !venue.is_active;
  const { error } = await supabase.from("venues").update({ is_active: nextActive }).eq("id", venueId);
  if (error) return void (await sendMessage(chatId, `⚠️ Не сохранилось: ${escapeHtml(error.message)}`));

  await sendMessage(
    chatId,
    nextActive
      ? `🟢 «${escapeHtml(venue.name)}» снова активно — меню доступно гостям.`
      : `🔴 «${escapeHtml(venue.name)}» выключено — меню и заказы больше недоступны гостям.`,
    { reply_markup: MAIN_MARKUP },
  );
}

const BROADCAST_PROMPT_HEAD = "Рассылка владельцам";

async function handleBroadcastPrompt(chatId: string) {
  await sendMessage(
    chatId,
    `${BROADCAST_PROMPT_HEAD}\n\nПришлите текст или фото (можно с подписью) — уйдёт всем владельцам, у кого подключён Telegram-бот заведения.`,
    { reply_markup: { force_reply: true, selective: true } },
  );
}

type OwnerVenue = { telegram_bot_token: string; telegram_chat_id: number };

async function fetchOwnerVenues(): Promise<OwnerVenue[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("venues")
    .select("telegram_bot_token, telegram_chat_id")
    .not("telegram_bot_token", "is", null)
    .not("telegram_chat_id", "is", null);
  if (error) throw new Error(`venues: ${error.message}`);
  return (data ?? []).filter(
    (v): v is OwnerVenue => Boolean(v.telegram_bot_token) && v.telegram_chat_id != null,
  );
}

/** file_id из update — валиден только для бота, которым его получили
 * (MENORA_ADMIN_BOT_TOKEN). Передать ЧУЖИМ ботам (у каждого заведения свой)
 * ссылку api.telegram.org/file/... не выходит — Telegram сам не может её
 * дозагрузить кросс-ботом ("failed to get HTTP URL content"). Поэтому
 * скачиваем байты сами и заливаем каждому боту напрямую (multipart). */
async function downloadTelegramFile(fileId: string): Promise<{ blob: Blob; filename: string } | null> {
  const res = await tg("getFile", { file_id: fileId });
  const filePath = (res.result as Record<string, unknown> | undefined)?.file_path as string | undefined;
  if (!filePath) return null;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  if (!fileRes.ok) return null;
  const blob = await fileRes.blob();
  return { blob, filename: filePath.split("/").pop() ?? "photo.jpg" };
}

async function sendPhotoViaBot(
  botToken: string,
  chatId: number,
  photo: Blob,
  filename: string,
  caption: string,
): Promise<{ ok: boolean; description?: string }> {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  if (caption) form.append("caption", caption);
  form.append("parse_mode", "HTML");
  form.append("photo", photo, filename);

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method: "POST", body: form });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  return { ok: Boolean(json.ok), description: json.description };
}

/** В отличие от sendTelegramMessage/sendTelegramPhoto из ../lib/telegram
 * (те глотают ошибку — .catch(() => {})), здесь реально проверяем ответ
 * Telegram: у каждого заведения свой бот-токен, и без этого не отличить
 * "правда отправилось" от "бот заведения давно не отвечает / токен отозван". */
async function sendViaBot(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  return { ok: Boolean(json.ok), description: json.description };
}

async function reportBroadcastResult(chatId: string, total: number, sent: number, lastError: string) {
  const failed = total - sent;
  await sendMessage(
    chatId,
    `📢 Отправлено владельцам: ${sent} из ${total}` +
      (failed > 0 ? `\n⚠️ Не удалось: ${failed}${lastError ? ` — последняя причина: ${escapeHtml(lastError)}` : ""}` : ""),
    { reply_markup: MAIN_MARKUP },
  );
}

async function handleBroadcastReply(chatId: string, text: string) {
  const message = text.trim();
  if (!message) return void (await sendMessage(chatId, "Пустой текст — не отправлено."));

  const venues = await fetchOwnerVenues();
  let sent = 0;
  let lastError = "";
  for (const v of venues) {
    const result = await sendViaBot(v.telegram_bot_token, "sendMessage", {
      chat_id: v.telegram_chat_id,
      text: message,
      parse_mode: "HTML",
    });
    if (result.ok) sent++;
    else lastError = result.description ?? "неизвестная ошибка";
    // Держимся заметно ниже общего лимита Telegram (~30 сообщ/сек).
    await new Promise((r) => setTimeout(r, 40));
  }
  await reportBroadcastResult(chatId, venues.length, sent, lastError);
}

async function handleBroadcastPhotoReply(chatId: string, fileId: string, caption: string) {
  const file = await downloadTelegramFile(fileId);
  if (!file) return void (await sendMessage(chatId, "⚠️ Не удалось скачать фото, попробуйте прислать ещё раз."));

  const venues = await fetchOwnerVenues();
  let sent = 0;
  let lastError = "";
  for (const v of venues) {
    const result = await sendPhotoViaBot(v.telegram_bot_token, v.telegram_chat_id, file.blob, file.filename, caption);
    if (result.ok) sent++;
    else lastError = result.description ?? "неизвестная ошибка";
    await new Promise((r) => setTimeout(r, 40));
  }
  await reportBroadcastResult(chatId, venues.length, sent, lastError);
}

// Динамические админы (bot_admins) — в дополнение к статичным ADMIN_CHAT_IDS
// из переменной окружения. Статичные нельзя снять из бота (только в Vercel
// + Redeploy) — они последняя подстраховка, если кто-то удалит себя из
// bot_admins по ошибке.

async function isDynamicAdmin(chatId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("bot_admins").select("chat_id").eq("chat_id", Number(chatId)).maybeSingle();
  return Boolean(data);
}

async function addDynamicAdmin(chatId: string, name: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("bot_admins").upsert({ chat_id: Number(chatId), name });
}

async function fetchDynamicAdmins(): Promise<{ chat_id: number; name: string | null }[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("bot_admins").select("chat_id, name").order("added_at");
  if (error) throw new Error(`bot_admins: ${error.message}`);
  return data ?? [];
}

/** Кто-то, кого нет ни в статичном, ни в динамическом списке, прислал ровно
 * секретную фразу — единственное, на что бот вообще реагирует от чужих. */
async function handleInviteCodeMessage(chatId: string, fromName: string) {
  await addDynamicAdmin(chatId, fromName);
  await sendMessage(chatId, `✅ Доступ к боту выдан, ${escapeHtml(fromName)}.`, { reply_markup: MAIN_MARKUP });
}

async function handleAdminsList(chatId: string) {
  const dynamicAdmins = await fetchDynamicAdmins();

  const staticLines = ADMIN_CHAT_IDS.map((id) => `🔒 <code>${id}</code> — из настроек (снять можно только в Vercel)`);
  const dynamicLines = dynamicAdmins.map((a) => `👤 ${escapeHtml(a.name ?? "без имени")} — <code>${a.chat_id}</code>`);
  const lines = [...staticLines, ...dynamicLines];

  await sendMessage(chatId, `Админы бота:\n\n${lines.join("\n")}`, {
    reply_markup:
      dynamicAdmins.length > 0
        ? {
            inline_keyboard: dynamicAdmins.map((a) => [
              { text: `❌ Убрать: ${a.name ?? a.chat_id}`, callback_data: `rmadmin:${a.chat_id}` },
            ]),
          }
        : MAIN_MARKUP,
  });
}

async function handleRemoveAdmin(chatId: string, targetChatId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("bot_admins").delete().eq("chat_id", Number(targetChatId));
  if (error) return void (await sendMessage(chatId, `⚠️ Не удалось: ${escapeHtml(error.message)}`));
  await sendMessage(chatId, "✅ Доступ отозван.", { reply_markup: MAIN_MARKUP });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Без ?setup=... — просто "прогрев": внешний планировщик дёргает этот
  // адрес, чтобы функция не засыпала между сообщениями (см. webhook/[venueId]).
  if (!url.searchParams.has("setup")) {
    return NextResponse.json({ ok: true });
  }
  if (!SETUP_TOKEN || url.searchParams.get("setup") !== SETUP_TOKEN) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }
  const webhookUrl = `${url.origin}/api/telegram/admin`;
  const hook = await tg("setWebhook", {
    url: webhookUrl,
    ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
    allowed_updates: ["message", "callback_query"],
  });
  const info = await tg("getWebhookInfo", {});
  return NextResponse.json({ hook, info });
}

export async function POST(request: Request) {
  if (!BOT_TOKEN || ADMIN_CHAT_IDS.length === 0) return NextResponse.json({ ok: true });

  if (WEBHOOK_SECRET) {
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== WEBHOOK_SECRET) return NextResponse.json({ ok: false }, { status: 403 });
  }

  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  const cb = update.callback_query;
  const msg = update.message ?? cb?.message;
  const chatId: string | undefined = msg?.chat?.id?.toString();

  if (!chatId) return NextResponse.json({ ok: true });

  const isAdmin = ADMIN_CHAT_IDS.includes(chatId) || (await isDynamicAdmin(chatId));

  // Чужим чатам не отвечаем вообще — даже не показываем, что бот существует.
  // Единственное исключение — секретная фраза-приглашение (сама по себе,
  // без пояснений при несовпадении: не подсказываем чужим, что она вообще есть).
  if (!isAdmin) {
    const inviteText: string = (msg?.text ?? "").trim();
    if (!cb && ADMIN_INVITE_CODE && inviteText === ADMIN_INVITE_CODE) {
      const fromName =
        (msg?.from?.first_name as string | undefined) || (msg?.from?.username as string | undefined) || "без имени";
      await handleInviteCodeMessage(chatId, fromName);
    }
    return NextResponse.json({ ok: true });
  }

  try {
    if (cb) {
      const data: string = cb.data ?? "";
      await answerCallback(cb.id);
      if (data.startsWith("connect:")) await handleConnectPick(chatId, data.slice("connect:".length));
      else if (data.startsWith("import:")) await handleImportPick(chatId, data.slice("import:".length));
      else if (data.startsWith("stats:")) await handleStatsPick(chatId, data.slice("stats:".length));
      else if (data.startsWith("invite:")) await handleInvitePick(chatId, data.slice("invite:".length));
      else if (data.startsWith("toggle:")) await handleToggleAccessPick(chatId, data.slice("toggle:".length));
      else if (data.startsWith("rmadmin:")) await handleRemoveAdmin(chatId, data.slice("rmadmin:".length));
      return NextResponse.json({ ok: true });
    }

    const text: string = msg?.text ?? "";
    const repliedTo: string = msg?.reply_to_message?.text ?? "";
    const photos: { file_id: string }[] | undefined = msg?.photo;

    if (photos && photos.length > 0 && repliedTo.startsWith(BROADCAST_PROMPT_HEAD)) {
      // Фото шлётся отдельным полем, не в text — самая крупная версия последняя в массиве.
      const fileId = photos[photos.length - 1].file_id;
      const caption: string = msg?.caption ?? "";
      await handleBroadcastPhotoReply(chatId, fileId, caption);
    } else if (text === "/start") {
      await sendMessage(chatId, "Меню администратора Меноры.", { reply_markup: MAIN_MARKUP });
    } else if (text === BTN_CONNECT) {
      const venues = await fetchVenues();
      if (venues.length === 0) return void (await sendMessage(chatId, "Заведений пока нет."));
      await sendMessage(chatId, "Выберите заведение:", { reply_markup: venuePickerMarkup(venues, "connect") });
    } else if (text === BTN_IMPORT) {
      const venues = (await fetchVenues()).filter((v) => v.velora_venue_id);
      if (venues.length === 0) {
        return void (await sendMessage(chatId, `Нет подключённых заведений — сначала ${BTN_CONNECT}.`));
      }
      await sendMessage(chatId, "Из какого заведения скопировать товары?", {
        reply_markup: venuePickerMarkup(venues, "import"),
      });
    } else if (text === BTN_SYNC_STOCK) {
      await sendMessage(chatId, "Проверяю остатки в Velora…");
      const result = await syncVeloraStock();
      await sendMessage(
        chatId,
        `✅ Заведений проверено: ${result.venuesChecked}\nБлюд обновлено: ${result.dishesUpdated}`,
        { reply_markup: MAIN_MARKUP },
      );
    } else if (text === BTN_STATS) {
      const venues = await fetchVenues();
      if (venues.length === 0) return void (await sendMessage(chatId, "Заведений пока нет."));
      await sendMessage(chatId, "Статистика по какому заведению?", { reply_markup: venuePickerMarkup(venues, "stats") });
    } else if (text === BTN_MY_VENUES) {
      await handleMyVenues(chatId);
    } else if (text === BTN_INVITE) {
      const venues = await fetchVenues();
      if (venues.length === 0) return void (await sendMessage(chatId, "Заведений пока нет."));
      await sendMessage(chatId, "Для какого заведения сгенерировать инвайт-код?", {
        reply_markup: venuePickerMarkup(venues, "invite"),
      });
    } else if (text === BTN_TOGGLE_ACCESS) {
      const venues = await fetchVenues();
      if (venues.length === 0) return void (await sendMessage(chatId, "Заведений пока нет."));
      await sendMessage(chatId, "Какому заведению переключить доступ (🟢 включено / 🔴 выключено)?", {
        reply_markup: toggleAccessMarkup(venues),
      });
    } else if (text === BTN_BROADCAST) {
      await handleBroadcastPrompt(chatId);
    } else if (text === BTN_ADMINS) {
      await handleAdminsList(chatId);
    } else if (repliedTo.startsWith(CONNECT_PROMPT_HEAD)) {
      await handleConnectReply(chatId, repliedTo, text);
    } else if (repliedTo.startsWith(BROADCAST_PROMPT_HEAD)) {
      await handleBroadcastReply(chatId, text);
    } else if (/^[0-9a-f]{16,}$/i.test(text.trim())) {
      // Просто прислали токен без выбора заведения — быстрый справочник:
      // на что он ссылается, ничего никуда не сохраняем.
      const veloraVenue = await resolveVeloraVenue(text.trim());
      if (!veloraVenue) {
        await sendMessage(chatId, "⚠️ Velora не узнала этот токен (неверный или отозван).");
      } else {
        await sendMessage(
          chatId,
          `Это токен заведения «${escapeHtml(veloraVenue.name)}».\nvenue_id: <code>${veloraVenue.id}</code>\n\n` +
            `Чтобы подключить заведение Меноры к нему — нажмите ${BTN_CONNECT} и выберите заведение, там его и вставите.`,
        );
      }
    } else {
      await sendMessage(chatId, "Не понял. Выберите пункт меню.", { reply_markup: MAIN_MARKUP });
    }
  } catch (e) {
    await sendMessage(chatId, `⚠️ Ошибка: ${escapeHtml(String((e as Error)?.message ?? e))}`);
  }

  return NextResponse.json({ ok: true });
}
