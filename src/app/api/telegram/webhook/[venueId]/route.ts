import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  editTelegramMessage,
  answerTelegramCallback,
  setChatMenuButton,
  type TgMarkup,
} from "@/lib/telegram";
import {
  mainReplyMarkup,
  tablesMarkup,
  backOnlyMarkup,
  emptyMarkup,
  customerReplyMarkup,
  languagePickerMarkup,
  staffLanguagePickerMarkup,
  feedbackTagsMarkup,
  priceCategoriesMarkup,
  priceDishesMarkup,
  stageButtonFor,
  radiusPickerMarkup,
} from "@/lib/telegram-keyboard";
import { formatPrice, formatTime } from "@/lib/menu-utils";
import { fetchStaffChatIds, notifyStaff } from "@/lib/venue-staff";
import { advanceOrderStatus, type OrderStatus } from "@/lib/order-status";
import {
  BOT_TEXT,
  STAFF_TEXT,
  FEEDBACK_TAG_KEYS,
  FEEDBACK_TAG_STORED_LABEL,
  LANGUAGE_NAMES,
  resolveBotLang,
  type BotLang,
  type FeedbackTagKey,
} from "@/lib/bot-i18n";

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  address: string | null;
  phone: string | null;
  working_hours: unknown;
  telegram_bot_token: string | null;
  telegram_chat_id: number | null;
  staff_bot_language: string | null;
  staff_invite_code: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_radius_km: number | null;
};

function formatTodayHours(workingHours: unknown, lang: BotLang): string | null {
  if (!workingHours || typeof workingHours !== "object") return null;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  const range = (workingHours as Record<string, string>)[days[now.getDay()]];
  return range ? BOT_TEXT[lang].todayHours(range) : null;
}

function buildWelcomeCaption(venue: VenueRow, lang: BotLang): string {
  const t = BOT_TEXT[lang];
  const lines = [t.welcomeLine(venue.name)];
  if (venue.description) lines.push(venue.description);
  const hours = formatTodayHours(venue.working_hours, lang);
  if (hours) lines.push(`🕐 ${hours}`);
  lines.push(t.menuHint);
  return lines.join("\n\n");
}

function renderContacts(venue: VenueRow, lang: BotLang): string {
  const t = BOT_TEXT[lang];
  const lines = [t.contactsHeader(venue.name)];
  if (venue.address) {
    lines.push(venue.address);
    lines.push(`<a href="https://maps.google.com/?q=${encodeURIComponent(venue.address)}">${t.openMap}</a>`);
  }
  if (venue.phone) lines.push(`☎️ ${venue.phone}`);
  if (!venue.address && !venue.phone) lines.push(t.noContacts);
  return lines.join("\n");
}

async function renderCustomerOrders(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  chatId: number,
  lang: BotLang,
): Promise<string> {
  const t = BOT_TEXT[lang];
  const { data: orders } = await admin
    .from("orders")
    .select("id, order_number, created_at, status, sent_at, total")
    .eq("venue_id", venueId)
    .eq("customer_telegram_chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!orders?.length) return t.noOrders;

  const lines = orders.map((o) => {
    const label = (t.status as unknown as Record<string, string>)[o.status] ?? t.status.new;
    const when = new Date(o.created_at).toLocaleString("ru-RU", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${label} · ${when} · ${formatPrice(o.total, "UZS")} · №${o.order_number}`;
  });
  return `${t.ordersHeader}\n\n${lines.join("\n")}`;
}

async function renderCustomerBonuses(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  chatId: number,
  lang: BotLang,
): Promise<string> {
  const t = BOT_TEXT[lang];
  const { data: customer } = await admin
    .from("telegram_customers")
    .select("phone")
    .eq("venue_id", venueId)
    .eq("chat_id", chatId)
    .maybeSingle();

  if (!customer?.phone) return t.noBonusPhone;

  const { data: loyalty } = await admin
    .from("loyalty_points")
    .select("points")
    .eq("venue_id", venueId)
    .eq("phone", customer.phone)
    .maybeSingle();

  const points = loyalty?.points ?? 0;
  return points > 0 ? t.bonusPoints(points) : t.noBonusPoints;
}

// Uzbekistan uses a single fixed UTC+5 offset year-round (no DST), so this
// is exact — unlike the Intl-round-trip trick used elsewhere in this file
// for same-day HH:MM comparisons, "today" here must be a real UTC instant
// since it's compared against absolute created_at timestamps.
function startOfTodayUzbekistanUTC(): string {
  const OFFSET_MS = 5 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() + OFFSET_MS);
  const startShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(startShifted - OFFSET_MS).toISOString();
}

async function renderTodayStats(admin: ReturnType<typeof createAdminClient>, venueId: string, lang: BotLang): Promise<string> {
  const t = STAFF_TEXT[lang].stats;
  const { data: orders } = await admin
    .from("orders")
    .select("total")
    .eq("venue_id", venueId)
    .gte("created_at", startOfTodayUzbekistanUTC());

  const count = orders?.length ?? 0;
  const revenue = (orders ?? []).reduce((sum, o) => sum + o.total, 0);
  const avg = count ? Math.round(revenue / count) : 0;

  return `${t.header}\n\n${t.orders}: ${count}\n${t.revenue}: ${formatPrice(revenue, "UZS")}\n${t.avgCheck}: ${formatPrice(avg, "UZS")}`;
}

async function renderPriceCategories(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  lang: BotLang,
): Promise<{ text: string; markup: TgMarkup }> {
  const t = STAFF_TEXT[lang].prices;
  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("sort_order");

  if (!categories?.length) return { text: t.noCategories, markup: emptyMarkup() };
  return { text: t.chooseCategory, markup: priceCategoriesMarkup(categories) };
}

async function renderPriceDishes(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  categoryId: string,
  lang: BotLang,
): Promise<{ text: string; markup: TgMarkup }> {
  const t = STAFF_TEXT[lang].prices;
  const { data: dishes } = await admin
    .from("dishes")
    .select("id, name, price, currency")
    .eq("venue_id", venueId)
    .eq("category_id", categoryId)
    .order("sort_order");

  if (!dishes?.length) return { text: t.noDishesInCategory, markup: backOnlyMarkup("pricecats", lang) };
  return {
    text: t.chooseDish,
    markup: priceDishesMarkup(
      dishes.map((d) => ({ id: d.id, name: d.name, priceLabel: formatPrice(d.price, d.currency) })),
      lang,
    ),
  };
}

type OrderRow = {
  id: string;
  status: string;
  customer_name: string;
  phone: string;
  address: string | null;
  comment: string | null;
  total: number;
  created_at: string;
  order_items: { dish_name: string; price: number; quantity: number }[];
};

function formatOrderText(o: OrderRow, header: string, extraCount: number, lang: BotLang) {
  const t = STAFF_TEXT[lang].order;
  const stageLabel = (STAFF_TEXT[lang].stages as unknown as Record<string, string>)[o.status] ?? "";
  const lines = o.order_items.map(
    (i) => `• ${i.dish_name} × ${i.quantity} — ${formatPrice(i.price * i.quantity, "UZS")}`,
  );
  return (
    `${header} · ${stageLabel}\n🕐 ${t.orderedAt} ${formatTime(o.created_at)}\n\n${lines.join("\n")}\n\n${t.total}: <b>${formatPrice(o.total, "UZS")}</b>\n` +
    `${t.name}: ${o.customer_name}\n${t.phone}: ${o.phone}` +
    (o.address ? `\n${t.address}: ${o.address}` : "") +
    (o.comment ? `\n${t.comment}: ${o.comment}` : "") +
    (extraCount > 0 ? t.queueNote(extraCount) : "")
  );
}

async function renderDelivery(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  lang: BotLang,
): Promise<{ text: string; markup: TgMarkup }> {
  const t = STAFF_TEXT[lang];
  const { data: orders } = await admin
    .from("orders")
    .select("id, status, customer_name, phone, address, comment, total, created_at, order_items(dish_name, price, quantity)")
    .eq("venue_id", venueId)
    .eq("fulfillment", "delivery")
    .neq("status", "sent")
    .order("created_at", { ascending: true });

  if (!orders?.length) {
    return { text: t.delivery.noOrders, markup: emptyMarkup() };
  }
  const o = orders[0] as unknown as OrderRow;
  const next = stageButtonFor(o.status, lang);
  return {
    text: formatOrderText(o, t.delivery.header(orders.length), orders.length - 1, lang),
    markup: {
      inline_keyboard: [
        ...(next ? [[{ text: next.label, callback_data: `stage|${o.id}|${next.nextStatus}|delivery` }]] : []),
        [{ text: t.tables.backButton, callback_data: "close" }],
      ],
    },
  };
}

type TableSummary = { count: number; total: number };

async function getActiveTablesSummary(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
): Promise<Map<string, TableSummary>> {
  const { data } = await admin
    .from("orders")
    .select("table_number, total")
    .eq("venue_id", venueId)
    .eq("fulfillment", "dine_in")
    .neq("status", "sent");

  const summary = new Map<string, TableSummary>();
  for (const o of data ?? []) {
    if (!o.table_number) continue;
    const cur = summary.get(o.table_number) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += o.total;
    summary.set(o.table_number, cur);
  }
  return summary;
}

// Shown above the table grid — an at-a-glance view of what's cooking where,
// so staff don't have to open every table just to see if it's busy.
function renderTablesHeader(summary: Map<string, TableSummary>, lang: BotLang): string {
  const t = STAFF_TEXT[lang].tables;
  if (summary.size === 0) return `${t.headerWithCount(0)}\n\n${t.noActive}\n\n${t.chooseTable}`;
  const lines = [...summary.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([n, s]) => t.summaryLine(n, s.count, formatPrice(s.total, "UZS")));
  return `${t.headerWithCount(summary.size)}\n\n${lines.join("\n")}\n\n${t.chooseTable}`;
}

async function renderTable(
  admin: ReturnType<typeof createAdminClient>,
  venueId: string,
  n: string,
  lang: BotLang,
): Promise<{ text: string; markup: TgMarkup }> {
  const t = STAFF_TEXT[lang].tables;
  const { data: orders } = await admin
    .from("orders")
    .select("id, status, customer_name, phone, address, comment, total, created_at, order_items(dish_name, price, quantity)")
    .eq("venue_id", venueId)
    .eq("fulfillment", "dine_in")
    .eq("table_number", n)
    .neq("status", "sent")
    .order("created_at", { ascending: true });

  if (!orders?.length) {
    return { text: t.noOrdersAtTable(n), markup: backOnlyMarkup("tables", lang) };
  }

  const rows = orders as unknown as OrderRow[];
  const total = rows.reduce((sum, o) => sum + o.total, 0);
  const header = t.tableHeader(n, rows.length, formatPrice(total, "UZS"));
  const blocks = rows.map((o, i) => formatOrderText(o, `${i + 1}) ${formatTime(o.created_at)}`, 0, lang));

  const markup: TgMarkup = {
    inline_keyboard: [
      ...rows.flatMap((o) => {
        const next = stageButtonFor(o.status, lang);
        const buttons = [];
        if (next) buttons.push({ text: next.label, callback_data: `stage|${o.id}|${next.nextStatus}|table|${n}` });
        buttons.push({ text: t.cancelButton, callback_data: `cancel|${o.id}|table|${n}` });
        return [buttons];
      }),
      [{ text: t.backButton, callback_data: "tables" }],
    ],
  };

  return { text: `${header}\n\n${blocks.join("\n\n")}`, markup };
}

// Ничего не делает — только чтобы внешний планировщик (см. README/чат) мог
// периодически "будить" эту serverless-функцию и не давать ей засыпать
// между сообщениями (Vercel Hobby: первый запрос после паузы поднимается
// 1-3+ сек, это и есть "бот долго отвечает после тишины").
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, { params }: { params: Promise<{ venueId: string }> }) {
  const { venueId } = await params;
  const update = await request.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const { data: venue } = await admin
    .from("venues")
    .select(
      "id, name, slug, description, cover_url, address, phone, working_hours, telegram_bot_token, telegram_chat_id, staff_bot_language, staff_invite_code, latitude, longitude, delivery_radius_km",
    )
    .eq("id", venueId)
    .maybeSingle<VenueRow>();

  if (!venue?.telegram_bot_token) return NextResponse.json({ ok: true });
  const token = venue.telegram_bot_token;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const staffLang = resolveBotLang(venue.staff_bot_language);

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const data = String(cb.data ?? "");
    if (!chatId || !messageId) return NextResponse.json({ ok: true });

    const parts = data.split("|");
    const action = parts[0];
    let toast: string | undefined;

    if (action === "close") {
      await editTelegramMessage(token, chatId, messageId, STAFF_TEXT[staffLang].menuOpenedBelow, emptyMarkup());
    } else if (action === "tables") {
      const summary = await getActiveTablesSummary(admin, venueId);
      await editTelegramMessage(
        token,
        chatId,
        messageId,
        renderTablesHeader(summary, staffLang),
        tablesMarkup(new Set(summary.keys()), staffLang),
      );
    } else if (action === "table") {
      const view = await renderTable(admin, venueId, parts[1], staffLang);
      await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
    } else if (action === "stage") {
      // Один шаг цепочки за раз: принят -> готовится -> готов -> отправлен.
      // orderActionsMarkup/stageButtonFor уже гарантируют, что newStatus —
      // это ровно следующий шаг после текущего, а не произвольный прыжок.
      const orderId = parts[1];
      const newStatus = parts[2] as OrderStatus;
      const context = parts.slice(3).join("|");
      await advanceOrderStatus({ venueId, orderId, status: newStatus });

      const stagesT = STAFF_TEXT[staffLang].stages;
      toast =
        newStatus === "preparing" ? stagesT.startCookingToast : newStatus === "ready" ? stagesT.readyToast : stagesT.sentToast;

      if (context === "delivery") {
        const view = await renderDelivery(admin, venueId, staffLang);
        await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
      } else if (context.startsWith("table|")) {
        const view = await renderTable(admin, venueId, context.split("|")[1], staffLang);
        await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
      } else {
        // Отдельное push-уведомление (без списка вокруг) — дописываем стадию
        // в конец, следующая кнопка (если ещё есть шаг) остаётся на месте.
        const originalText = String(cb.message?.text ?? "");
        const stageLabel = (stagesT as unknown as Record<string, string>)[newStatus];
        const next = stageButtonFor(newStatus, staffLang);
        const newMarkup: TgMarkup = next
          ? { inline_keyboard: [[{ text: next.label, callback_data: `stage|${orderId}|${next.nextStatus}|` }]] }
          : emptyMarkup();
        await editTelegramMessage(token, chatId, messageId, `${originalText}\n\n${stageLabel}`, newMarkup);
      }
    } else if (action === "cancel") {
      const orderId = parts[1];
      const context = parts.slice(2).join("|");
      await admin.from("orders").delete().eq("id", orderId);
      toast = STAFF_TEXT[staffLang].cancelToast;

      if (context === "delivery") {
        const view = await renderDelivery(admin, venueId, staffLang);
        await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
      } else if (context.startsWith("table|")) {
        const view = await renderTable(admin, venueId, context.split("|")[1], staffLang);
        await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
      } else {
        const originalText = String(cb.message?.text ?? "");
        await editTelegramMessage(token, chatId, messageId, `${originalText}\n\n${STAFF_TEXT[staffLang].cancelAppended}`, emptyMarkup());
      }
    } else if (action === "rate") {
      const orderId = parts[1];
      const rating = Number(parts[2]);
      const { data: rater } = await admin
        .from("telegram_customers")
        .select("language")
        .eq("venue_id", venueId)
        .eq("chat_id", chatId)
        .maybeSingle();
      const lang = resolveBotLang(rater?.language);
      const t = BOT_TEXT[lang];

      const { error } = await admin
        .from("ratings")
        .insert({ order_id: orderId, venue_id: venueId, telegram_chat_id: chatId, rating });

      if (error) {
        // 23505 = unique_violation on ratings.order_id — this order was already rated.
        toast = error.code === "23505" ? t.alreadyRated : t.ratingSaveFail;
      } else {
        toast = `${t.ratingThanksPrefix} ${"⭐".repeat(rating)}`;
        await editTelegramMessage(token, chatId, messageId, `${t.ratingThanksPrefix} ${"⭐".repeat(rating)}`, emptyMarkup());
        if (rating <= 3) {
          await sendTelegramMessage(token, chatId, t.feedbackPrompt, feedbackTagsMarkup(orderId, lang));
          {
            const { data: order } = await admin.from("orders").select("customer_name, phone, order_number").eq("id", orderId).maybeSingle();
            const st = STAFF_TEXT[staffLang];
            const name = order?.customer_name ?? (staffLang === "uz" ? "mijoz" : "клиента");
            const phonePart = order?.phone ? ` (${order.phone})` : "";
            await notifyStaff(
              token,
              venueId,
              venue.telegram_chat_id,
              st.lowRatingAlert("⭐".repeat(rating), name, phonePart, String(order?.order_number ?? "")),
            );
          }
        }
      }
    } else if (action === "tag") {
      const orderId = parts[1];
      const tagKey = parts[2] as FeedbackTagKey;
      const { data: tagger } = await admin
        .from("telegram_customers")
        .select("language")
        .eq("venue_id", venueId)
        .eq("chat_id", chatId)
        .maybeSingle();
      const lang = resolveBotLang(tagger?.language);

      if ((FEEDBACK_TAG_KEYS as readonly string[]).includes(tagKey)) {
        // Stored label is always Russian regardless of the customer's
        // language — the owner's Reviews page is Russian-only.
        const storedLabel = FEEDBACK_TAG_STORED_LABEL[tagKey];
        const { data: existing } = await admin.from("ratings").select("tags").eq("order_id", orderId).maybeSingle();
        const nextTags = Array.from(new Set([...(existing?.tags ?? []), storedLabel]));
        await admin.from("ratings").update({ tags: nextTags }).eq("order_id", orderId);
        {
          const { data: order } = await admin.from("orders").select("order_number").eq("id", orderId).maybeSingle();
          await notifyStaff(
            token,
            venueId,
            venue.telegram_chat_id,
            STAFF_TEXT[staffLang].tagAlert(String(order?.order_number ?? ""), storedLabel),
          );
        }
      }
      toast = BOT_TEXT[lang].tagThanks;
      await editTelegramMessage(token, chatId, messageId, BOT_TEXT[lang].tagThanks, emptyMarkup());
    } else if (action === "setlang") {
      const lang = resolveBotLang(parts[1]);
      const from = cb.from ?? {};
      if (from.id) {
        await admin.from("telegram_customers").upsert(
          {
            venue_id: venueId,
            telegram_user_id: from.id,
            chat_id: chatId,
            language: lang,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "venue_id,telegram_user_id" },
        );
      }
      toast = BOT_TEXT[lang].languageSaved(LANGUAGE_NAMES[lang]);
      await editTelegramMessage(token, chatId, messageId, toast, emptyMarkup());

      // First-ever pick (onboarding) or a later switch — either way, (re)send
      // the welcome card + keyboard now that we know their language.
      const { data: customerRow } = await admin
        .from("telegram_customers")
        .select("active_table_number")
        .eq("venue_id", venueId)
        .eq("chat_id", chatId)
        .maybeSingle();
      const table = customerRow?.active_table_number ?? undefined;
      const markup = customerReplyMarkup(venue.slug, siteUrl, lang, table);
      const caption = buildWelcomeCaption(venue, lang) + (table ? `\n\n${BOT_TEXT[lang].tableLine(table)}` : "");
      if (venue.cover_url) {
        await sendTelegramPhoto(token, chatId, venue.cover_url, caption, markup);
      } else {
        await sendTelegramMessage(token, chatId, caption, markup);
      }
    } else if (action === "setstafflang") {
      const lang = resolveBotLang(parts[1]);
      await admin.from("venues").update({ staff_bot_language: lang }).eq("id", venueId);
      toast = STAFF_TEXT[lang].languageSaved(LANGUAGE_NAMES[lang]);
      await editTelegramMessage(token, chatId, messageId, toast, emptyMarkup());
      await sendTelegramMessage(token, chatId, STAFF_TEXT[lang].fallbackUseButtons(venue.name), mainReplyMarkup(siteUrl, lang));
    } else if (action === "pricecats") {
      const view = await renderPriceCategories(admin, venueId, staffLang);
      await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
    } else if (action === "pricecat") {
      const view = await renderPriceDishes(admin, venueId, parts[1], staffLang);
      await editTelegramMessage(token, chatId, messageId, view.text, view.markup);
    } else if (action === "editprice") {
      const dishId = parts[1];
      const t = STAFF_TEXT[staffLang].prices;
      const { data: dish } = await admin
        .from("dishes")
        .select("name, price, currency")
        .eq("id", dishId)
        .eq("venue_id", venueId)
        .maybeSingle();
      if (dish) {
        // Tracked server-side (bot_pending_price_edits) rather than via
        // Telegram's reply_to_message — force_reply turned out to silently
        // fail to register as an actual "reply" on some clients, losing the
        // typed price with no error shown. This works regardless of how the
        // staff member sends their next message.
        await admin
          .from("bot_pending_price_edits")
          .upsert({ chat_id: chatId, venue_id: venueId, dish_id: dishId }, { onConflict: "chat_id" });
        await sendTelegramMessage(token, chatId, t.editPrompt(dish.name, formatPrice(dish.price, dish.currency)));
      } else {
        toast = t.dishNotFoundToast;
      }
    } else if (action === "setradius") {
      const rt = STAFF_TEXT[staffLang].radius;
      if (parts[1] === "relocate") {
        await admin.from("bot_pending_venue_location").upsert({ chat_id: chatId, venue_id: venueId });
        await editTelegramMessage(token, chatId, messageId, rt.askLocation, emptyMarkup());
      } else if (venue.latitude == null || venue.longitude == null) {
        // Гонка: успели нажать кнопку до того, как локация сохранилась.
        toast = rt.needLocationFirst;
      } else {
        const km = Number(parts[1]) || null;
        await admin.from("venues").update({ delivery_radius_km: km }).eq("id", venueId);
        toast = rt.radiusSaved(km);
        await editTelegramMessage(token, chatId, messageId, rt.radiusSaved(km), emptyMarkup());
      }
    }

    await answerTelegramCallback(token, cb.id, toast);
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  const text = String(message?.text ?? "").trim();
  const chatId = message?.chat?.id;
  if (!chatId) return NextResponse.json({ ok: true });

  // The same bot serves two audiences. Staff is no longer a single chat —
  // venue_staff holds the whole list (see src/lib/venue-staff.ts), seeded
  // from the old single telegram_chat_id. Empty list = nobody has ever
  // pressed Start yet, so whoever does first becomes staff (bootstrap).
  // Anyone else messaging the same bot is a customer — they get the Mini
  // App menu button instead.
  const staffChatIds = await fetchStaffChatIds(venueId, venue.telegram_chat_id);
  const isStaffChat = staffChatIds.length === 0 || staffChatIds.includes(chatId);

  // Секретная фраза заведения (staff_invite_code, выдаётся кнопкой "Добавить
  // сотрудника" ниже) — единственное, на что отвечает бот от НЕ-персонала,
  // помимо обычного клиентского флоу. Совпало — человек сам становится
  // персоналом, без участия владельца.
  if (!isStaffChat && venue.staff_invite_code && text === venue.staff_invite_code) {
    const from = message.from ?? {};
    const staffName = (from.first_name as string | undefined) || (from.username as string | undefined) || "без имени";
    await admin.from("venue_staff").upsert({ venue_id: venueId, chat_id: chatId, name: staffName });
    await setChatMenuButton(token, `${siteUrl}/cabinet`, chatId);
    await sendTelegramMessage(token, chatId, STAFF_TEXT[staffLang].connected(venue.name), mainReplyMarkup(siteUrl, staffLang));
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start")) {
    if (isStaffChat) {
      if (!venue.telegram_chat_id) {
        // Самый первый /start этому боту вообще — становится основным.
        await admin.from("venues").update({ telegram_chat_id: chatId }).eq("id", venue.id);
      }
      // Override the bot-wide Menu button (customer Mini App, set in
      // setVenueBotToken) for just this chat, so the persistent Menu button
      // next to the input opens the Cabinet for staff instead.
      await setChatMenuButton(token, `${siteUrl}/cabinet`, chatId);
      await sendTelegramMessage(token, chatId, STAFF_TEXT[staffLang].connected(venue.name), mainReplyMarkup(siteUrl, staffLang));
    } else {
      const from = message.from ?? {};
      // A table's QR -> "Открыть в Telegram" choice deep-links here as
      // t.me/<bot>?start=table_5, which Telegram delivers as the text
      // "/start table_5" — see src/app/[slug]/scan/page.tsx.
      const startPayload = text.split(" ")[1];
      const tableFromPayload = startPayload?.match(/^table_(.+)$/)?.[1] ?? null;

      const { data: existing } = from.id
        ? await admin
            .from("telegram_customers")
            .select("active_table_number, language")
            .eq("venue_id", venue.id)
            .eq("telegram_user_id", from.id)
            .maybeSingle()
        : { data: null };

      const activeTable = tableFromPayload ?? existing?.active_table_number ?? null;

      if (from.id) {
        await admin.from("telegram_customers").upsert(
          {
            venue_id: venue.id,
            telegram_user_id: from.id,
            chat_id: chatId,
            username: from.username ?? null,
            first_name: from.first_name ?? null,
            last_name: from.last_name ?? null,
            ...(tableFromPayload ? { active_table_number: tableFromPayload } : {}),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "venue_id,telegram_user_id" },
        );
      }

      if (!existing) {
        // Brand-new customer — ask their language before anything else,
        // rather than assuming Russian. The welcome card follows once they
        // pick, via the "setlang" callback above.
        await sendTelegramMessage(token, chatId, BOT_TEXT.ru.chooseLanguage, languagePickerMarkup());
      } else {
        const lang = resolveBotLang(existing.language);
        const markup = customerReplyMarkup(venue.slug, siteUrl, lang, activeTable ?? undefined);
        const caption = buildWelcomeCaption(venue, lang) + (activeTable ? `\n\n${BOT_TEXT[lang].tableLine(activeTable)}` : "");
        if (venue.cover_url) {
          await sendTelegramPhoto(token, chatId, venue.cover_url, caption, markup);
        } else {
          await sendTelegramMessage(token, chatId, caption, markup);
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (!isStaffChat) {
    const { data: customerRow } = await admin
      .from("telegram_customers")
      .select("active_table_number, language")
      .eq("venue_id", venueId)
      .eq("chat_id", chatId)
      .maybeSingle();
    const lang = resolveBotLang(customerRow?.language);
    const t = BOT_TEXT[lang];
    const markup = customerReplyMarkup(venue.slug, siteUrl, lang, customerRow?.active_table_number ?? undefined);

    if (text === t.labels.orders) {
      await sendTelegramMessage(token, chatId, await renderCustomerOrders(admin, venueId, chatId, lang), markup);
    } else if (text === t.labels.bonuses) {
      await sendTelegramMessage(token, chatId, await renderCustomerBonuses(admin, venueId, chatId, lang), markup);
    } else if (text === t.labels.contacts) {
      await sendTelegramMessage(token, chatId, renderContacts(venue, lang), markup);
    } else if (text === t.labels.language) {
      await sendTelegramMessage(token, chatId, t.chooseLanguage, languagePickerMarkup());
    } else {
      await sendTelegramMessage(token, chatId, t.waitingForYou(venue.name), markup);
    }
    return NextResponse.json({ ok: true });
  }

  // Персонал прислал геолокацию (📎 → Геопозиция в Telegram) — сработает,
  // только если до этого нажали "📍 Радиус доставки" без сохранённых
  // координат заведения (bot_pending_venue_location, see above).
  if (message.location) {
    const { data: pendingLocation } = await admin
      .from("bot_pending_venue_location")
      .select("venue_id")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (pendingLocation) {
      await admin.from("bot_pending_venue_location").delete().eq("chat_id", chatId);
      await admin
        .from("venues")
        .update({ latitude: message.location.latitude, longitude: message.location.longitude })
        .eq("id", venueId);
      const rt = STAFF_TEXT[staffLang].radius;
      await sendTelegramMessage(token, chatId, rt.locationSaved);
      await sendTelegramMessage(token, chatId, rt.chooseRadius(venue.delivery_radius_km), radiusPickerMarkup(staffLang));
      return NextResponse.json({ ok: true });
    }
  }

  // Server-tracked "waiting for a new price" state (see the "editprice"
  // callback above) — checked on every staff text message so it works no
  // matter how they send the number.
  const PENDING_PRICE_EDIT_TTL_MS = 10 * 60 * 1000;
  const { data: pendingEdit } = await admin
    .from("bot_pending_price_edits")
    .select("dish_id, created_at")
    .eq("chat_id", chatId)
    .maybeSingle();

  if (pendingEdit) {
    await admin.from("bot_pending_price_edits").delete().eq("chat_id", chatId);
    const pt = STAFF_TEXT[staffLang].prices;

    if (Date.now() - new Date(pendingEdit.created_at).getTime() > PENDING_PRICE_EDIT_TTL_MS) {
      // Stale — silently drop it and fall through to normal button handling
      // below instead of surprising them with a price update long after
      // they'd moved on.
    } else {
      const newPrice = Number(text.replace(/[^\d]/g, ""));
      if (!newPrice || newPrice <= 0) {
        await sendTelegramMessage(token, chatId, pt.invalidPrice, mainReplyMarkup(siteUrl, staffLang));
      } else {
        const { data: dish, error } = await admin
          .from("dishes")
          .update({ price: newPrice })
          .eq("id", pendingEdit.dish_id)
          .eq("venue_id", venueId)
          .select("name, currency")
          .maybeSingle();
        if (error || !dish) {
          await sendTelegramMessage(token, chatId, pt.dishNotFoundForEdit, mainReplyMarkup(siteUrl, staffLang));
        } else {
          await sendTelegramMessage(token, chatId, pt.updated(dish.name, formatPrice(newPrice, dish.currency)), mainReplyMarkup(siteUrl, staffLang));
        }
      }
      return NextResponse.json({ ok: true });
    }
  }

  const staffLabels = STAFF_TEXT[staffLang].labels;

  if (text === staffLabels.tables) {
    const summary = await getActiveTablesSummary(admin, venueId);
    await sendTelegramMessage(token, chatId, renderTablesHeader(summary, staffLang), tablesMarkup(new Set(summary.keys()), staffLang));
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.delivery) {
    const view = await renderDelivery(admin, venueId, staffLang);
    await sendTelegramMessage(token, chatId, view.text, view.markup);
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.prices) {
    const view = await renderPriceCategories(admin, venueId, staffLang);
    await sendTelegramMessage(token, chatId, view.text, view.markup);
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.stats) {
    await sendTelegramMessage(token, chatId, await renderTodayStats(admin, venueId, staffLang));
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.invite) {
    // Фраза одна на заведение, постоянная (не пересоздаём при каждом
    // нажатии) — владелец один раз получает её и раздаёт всем, кого хочет
    // добавить, они просто пишут её этому же боту (см. проверку выше).
    let code = venue.staff_invite_code;
    if (!code) {
      const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // без 0/O/1/I/L — не спутать на глаз
      code = Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
      await admin.from("venues").update({ staff_invite_code: code }).eq("id", venue.id);
    }
    await sendTelegramMessage(token, chatId, STAFF_TEXT[staffLang].inviteCode(code), mainReplyMarkup(siteUrl, staffLang));
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.radius) {
    const rt = STAFF_TEXT[staffLang].radius;
    if (venue.latitude == null || venue.longitude == null) {
      // Нет координат заведения — сначала просим их прислать через саму
      // Telegram (message.location, обрабатывается ниже в этой функции),
      // а не спрашиваем через веб-форму, раз мы и так уже внутри бота.
      await admin.from("bot_pending_venue_location").upsert({ chat_id: chatId, venue_id: venueId });
      await sendTelegramMessage(token, chatId, rt.askLocation);
    } else {
      await sendTelegramMessage(token, chatId, rt.chooseRadius(venue.delivery_radius_km), radiusPickerMarkup(staffLang));
    }
    return NextResponse.json({ ok: true });
  }

  if (text === staffLabels.language) {
    await sendTelegramMessage(token, chatId, STAFF_TEXT[staffLang].chooseLanguage, staffLanguagePickerMarkup());
    return NextResponse.json({ ok: true });
  }

  await sendTelegramMessage(token, chatId, STAFF_TEXT[staffLang].fallbackUseButtons(venue.name), mainReplyMarkup(siteUrl, staffLang));
  return NextResponse.json({ ok: true });
}
