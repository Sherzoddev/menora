"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderActionsMarkup } from "@/lib/telegram-keyboard";
import { formatPrice, formatTime } from "@/lib/menu-utils";
import { pointsEarnedFor, POINT_VALUE, DEFAULT_LOYALTY_PERCENT } from "@/lib/loyalty";
import { verifyTelegramInitData } from "@/lib/telegram-init-data";
import { resolveBotLang } from "@/lib/bot-i18n";
import { pushOrderToVelora } from "@/lib/velora-actions";
import { notifyStaff } from "@/lib/venue-staff";
import { advanceOrderStatus, sendOrderTracker } from "@/lib/order-status";
import { distanceKm } from "@/lib/geo";

// Промокоды и баллы лояльности живут в таблицах без публичной RLS-policy
// (см. createOrder ниже), поэтому гость не может посчитать скидку сам — эта
// функция даёт живой предпросмотр итоговой суммы на чекауте, ещё до сабмита.
// Формулы (percent/fixed, округление, POINT_VALUE) намеренно продублированы
// из createOrder, а не вынесены в общий хелпер — createOrder уже в проде и
// трогать его логику ради рефакторинга рискованнее, чем поддерживать две
// небольшие копии в актуальном состоянии.
export async function previewOrderTotals(
  venueId: string,
  input: { subtotal: number; promoCode: string; phone: string; usePoints: boolean },
): Promise<{
  subtotal: number;
  promoDiscount: number;
  promoError: string | null;
  pointsAvailable: number;
  pointsDiscount: number;
  total: number;
}> {
  const subtotal = Math.max(0, input.subtotal);
  const promoInput = input.promoCode.trim();
  const phone = input.phone.trim();
  const adminDb = createAdminClient();

  let promoDiscount = 0;
  let promoError: string | null = null;
  if (promoInput) {
    const { data: promo } = await adminDb
      .from("promo_codes")
      .select("discount_type, discount_value, max_uses, used_count, is_active")
      .eq("venue_id", venueId)
      .eq("code", promoInput.toUpperCase())
      .maybeSingle();
    if (!promo || !promo.is_active || (promo.max_uses != null && promo.used_count >= promo.max_uses)) {
      promoError = "Промокод недействителен или больше не активен";
    } else {
      promoDiscount =
        promo.discount_type === "percent"
          ? Math.round((subtotal * promo.discount_value) / 100)
          : Math.round(promo.discount_value);
      promoDiscount = Math.min(promoDiscount, subtotal);
    }
  }

  let pointsAvailable = 0;
  let pointsDiscount = 0;
  if (phone) {
    const { data: loyaltyRow } = await adminDb
      .from("loyalty_points")
      .select("points")
      .eq("venue_id", venueId)
      .eq("phone", phone)
      .maybeSingle();
    pointsAvailable = loyaltyRow?.points ?? 0;
    if (input.usePoints && pointsAvailable > 0) {
      const afterPromo = subtotal - promoDiscount;
      const maxRedeemablePoints = Math.floor(afterPromo / POINT_VALUE);
      const pointsRedeemed = Math.min(pointsAvailable, maxRedeemablePoints);
      pointsDiscount = pointsRedeemed * POINT_VALUE;
    }
  }

  const total = Math.max(0, subtotal - promoDiscount - pointsDiscount);
  return { subtotal, promoDiscount, promoError, pointsAvailable, pointsDiscount, total };
}

export type CheckoutItem = {
  dishId: string;
  name: string;
  price: number;
  qty: number;
  veloraProductId: string | null;
};

export async function createOrder(
  venueId: string,
  _prevState: { error: string | null; ok?: boolean; orderId?: string },
  formData: FormData,
) {
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const fulfillment = String(formData.get("fulfillment") ?? "delivery");
  const address = String(formData.get("address") ?? "").trim();
  const tableNumber = String(formData.get("table_number") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const promoInput = String(formData.get("promo_code") ?? "").trim();
  const usePoints = formData.get("use_points") === "on";
  const itemsRaw = String(formData.get("items") ?? "[]");
  const clientRequestId = String(formData.get("client_request_id") ?? "").trim() || null;
  const tgInitData = String(formData.get("tg_init_data") ?? "").trim();
  const customerLat = formData.get("customer_lat") ? Number(formData.get("customer_lat")) : null;
  const customerLng = formData.get("customer_lng") ? Number(formData.get("customer_lng")) : null;

  if (!customerName) return { error: "Введите имя" };
  if (!phone) return { error: "Введите телефон" };
  if (!["delivery", "pickup", "dine_in"].includes(fulfillment)) {
    return { error: "Некорректный способ получения" };
  }
  if (fulfillment === "delivery" && !address) return { error: "Укажите адрес доставки" };
  if (fulfillment === "dine_in" && !tableNumber) return { error: "Не указан номер стола" };

  let rawItems: CheckoutItem[];
  try {
    rawItems = JSON.parse(itemsRaw);
  } catch {
    return { error: "Корзина повреждена, обновите страницу" };
  }
  if (!rawItems.length) return { error: "Корзина пуста" };

  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select(
      "name, telegram_chat_id, telegram_bot_token, loyalty_percent, staff_bot_language, velora_venue_id, velora_token, latitude, longitude, delivery_radius_km",
    )
    .eq("id", venueId)
    .single();

  // Заведение включило ограничение радиуса (указало координаты через бота
  // и выбрало км) — тогда точное местоположение гостя обязательно. Раньше
  // проверка срабатывала только когда customerLat/Lng случайно были в
  // запросе (гость нажал кнопку геолокации на чекауте) — при обычном ручном
  // вводе адреса текстом координат не было, и радиус молча не проверялся
  // вообще. Это тоже подстраховка от прямого POST мимо интерфейса — сам
  // чекаут теперь тоже требует точку на карте, когда радиус включён.
  const radiusEnforced =
    fulfillment === "delivery" && venue?.latitude != null && venue?.longitude != null && venue?.delivery_radius_km != null;
  if (radiusEnforced) {
    if (customerLat == null || customerLng == null) {
      return {
        error: "У заведения ограничена зона доставки — укажите точное местоположение кнопкой геолокации или на карте.",
      };
    }
    const distance = distanceKm(venue!.latitude!, venue!.longitude!, customerLat, customerLng);
    if (distance > venue!.delivery_radius_km!) {
      return {
        error: `Вы примерно в ${Math.round(distance)} км от заведения — доставка работает в радиусе ${venue!.delivery_radius_km} км. Свяжитесь с заведением напрямую или выберите самовывоз.`,
      };
    }
  }

  // A retry/double-tap (flaky connection, impatient double-click, Telegram
  // Mini App re-submitting) reuses the same client_request_id — return the
  // order that already exists instead of creating a second one.
  if (clientRequestId) {
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (existingOrder) {
      return { error: null, ok: true, orderId: existingOrder.id };
    }
  }

  // If this checkout came from the Telegram Mini App, tg_init_data proves
  // (via HMAC signed with the venue's own bot token) which Telegram user is
  // ordering, so we know who to notify later about "sent"/rating requests.
  let customerTelegramChatId: number | null = null;
  if (tgInitData && venue?.telegram_bot_token) {
    const verifiedUser = verifyTelegramInitData(tgInitData, venue.telegram_bot_token);
    if (verifiedUser) {
      // Telegram user id doubles as the private chat id for DMs with a bot.
      customerTelegramChatId = verifiedUser.id;
      await createAdminClient()
        .from("telegram_customers")
        .upsert(
          {
            venue_id: venueId,
            telegram_user_id: verifiedUser.id,
            chat_id: verifiedUser.id,
            username: verifiedUser.username,
            first_name: verifiedUser.firstName,
            last_name: verifiedUser.lastName,
            phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "venue_id,telegram_user_id" },
        );
    }
  }

  // Never trust price/qty from the client — re-price every line from the
  // dishes table so a tampered cart payload can't produce a discounted or
  // free order. dishId + venueId + availability are re-checked too, since a
  // dish could belong to another venue or have gone unavailable meanwhile.
  const dishIds = [...new Set(rawItems.map((i) => i.dishId))];
  const { data: dbDishes } = await supabase
    .from("dishes")
    .select("id, name, price, discount_price, is_available, out_of_stock, venue_id, velora_product_id")
    .in("id", dishIds);
  const dishById = new Map((dbDishes ?? []).map((d) => [d.id, d]));

  const items: CheckoutItem[] = [];
  for (const raw of rawItems) {
    const dish = dishById.get(raw.dishId);
    const qty = Math.floor(Number(raw.qty));
    if (!dish || dish.venue_id !== venueId || !dish.is_available || dish.out_of_stock) {
      return { error: `Блюдо «${raw.name}» больше недоступно, обновите меню` };
    }
    if (!Number.isFinite(qty) || qty < 1 || qty > 50) {
      return { error: "Некорректное количество товара в корзине" };
    }
    items.push({
      dishId: dish.id,
      name: dish.name,
      price: dish.discount_price ?? dish.price,
      qty,
      veloraProductId: dish.velora_product_id,
    });
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

  // Promo codes and loyalty points live in owner-only tables (RLS has no
  // public policy for them), so guests validate/redeem through this
  // server action using the service-role client rather than direct table access.
  const adminDb = createAdminClient();

  let promoDiscount = 0;
  let appliedPromoCode: string | null = null;
  let promoRow: { id: string; used_count: number } | null = null;

  if (promoInput) {
    const { data: promo } = await adminDb
      .from("promo_codes")
      .select("id, discount_type, discount_value, max_uses, used_count, is_active")
      .eq("venue_id", venueId)
      .eq("code", promoInput.toUpperCase())
      .maybeSingle();

    if (!promo || !promo.is_active || (promo.max_uses != null && promo.used_count >= promo.max_uses)) {
      return { error: "Промокод недействителен или больше не активен" };
    }

    promoDiscount =
      promo.discount_type === "percent"
        ? Math.round((subtotal * promo.discount_value) / 100)
        : Math.round(promo.discount_value);
    promoDiscount = Math.min(promoDiscount, subtotal);
    appliedPromoCode = promoInput.toUpperCase();
    promoRow = { id: promo.id, used_count: promo.used_count };
  }

  let pointsRedeemed = 0;
  let pointsDiscount = 0;
  let loyaltyPoints = 0;

  const { data: loyaltyRow } = await adminDb
    .from("loyalty_points")
    .select("points")
    .eq("venue_id", venueId)
    .eq("phone", phone)
    .maybeSingle();
  loyaltyPoints = loyaltyRow?.points ?? 0;

  const afterPromo = subtotal - promoDiscount;
  if (usePoints && loyaltyPoints > 0) {
    const maxRedeemablePoints = Math.floor(afterPromo / POINT_VALUE);
    pointsRedeemed = Math.min(loyaltyPoints, maxRedeemablePoints);
    pointsDiscount = pointsRedeemed * POINT_VALUE;
  }

  const total = Math.max(0, afterPromo - pointsDiscount);
  const pointsEarned = pointsEarnedFor(total, venue?.loyalty_percent ?? DEFAULT_LOYALTY_PERCENT);

  // Guests can INSERT orders but (by design) can't SELECT them back — only the
  // venue's admin/owner can read orders. Chaining .select() on the insert would
  // ask Postgres to RETURNING a row the inserting role isn't allowed to see,
  // which Postgres reports as an RLS violation on the insert itself. So we
  // generate the id ourselves and skip RETURNING entirely.
  const orderId = crypto.randomUUID();

  const { error } = await supabase.from("orders").insert({
    id: orderId,
    venue_id: venueId,
    customer_name: customerName,
    phone,
    fulfillment,
    address: fulfillment === "delivery" ? address : null,
    table_number: fulfillment === "dine_in" ? tableNumber : null,
    comment: comment || null,
    total,
    discount: promoDiscount + pointsDiscount,
    promo_code: appliedPromoCode,
    points_earned: pointsEarned,
    points_redeemed: pointsRedeemed,
    client_request_id: clientRequestId,
    customer_telegram_chat_id: customerTelegramChatId,
    // Overwritten unconditionally by the assign_order_number() BEFORE INSERT
    // trigger — required here only because generated types mark the column
    // NOT NULL (PostgREST can't see the trigger default).
    order_number: 0,
  });

  if (error) {
    // Rare race: two near-simultaneous submits with the same
    // client_request_id both passed the earlier existence check before
    // either finished inserting. The unique index still caught it — return
    // the (other request's) order instead of showing a scary error.
    if (error.code === "23505" && clientRequestId) {
      const { data: raceWinner } = await supabase
        .from("orders")
        .select("id")
        .eq("venue_id", venueId)
        .eq("client_request_id", clientRequestId)
        .maybeSingle();
      if (raceWinner) return { error: null, ok: true, orderId: raceWinner.id };
    }
    return { error: error.message };
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((i) => ({
      order_id: orderId,
      dish_id: i.dishId,
      dish_name: i.name,
      price: i.price,
      quantity: i.qty,
    })),
  );

  if (itemsError) return { error: itemsError.message };

  // Всё отсюда и до конца не нужно гостю ждать — это внутренняя бухгалтерия
  // и уведомления, а не то, что определяет "заказ принят". Раньше все эти
  // шаги (особенно поход в Velora — отдельный сервис по сети, и отправка в
  // Telegram) шли последовательно ДО ответа сайту, из-за чего оформление
  // заказа ощущалось на 10+ секунд дольше, чем реально нужно. after()
  // выполняет их уже после того, как гость получил "заказ оформлен".
  after(async () => {
    if (venue?.velora_venue_id && venue?.velora_token) {
      await pushOrderToVelora({
        veloraVenueId: venue.velora_venue_id,
        veloraToken: venue.velora_token,
        fulfillment,
        tableNumber,
        items: items.map((i) => ({ name: i.name, price: i.price, qty: i.qty, veloraProductId: i.veloraProductId })),
        customerName,
        discount: promoDiscount + pointsDiscount,
      });
    }

    if (promoRow) {
      await adminDb.from("promo_codes").update({ used_count: promoRow.used_count + 1 }).eq("id", promoRow.id);
    }

    const pointsBalance = loyaltyPoints - pointsRedeemed + pointsEarned;
    await adminDb
      .from("loyalty_points")
      .upsert(
        { venue_id: venueId, phone, points: pointsBalance, updated_at: new Date().toISOString() },
        { onConflict: "venue_id,phone" },
      );

    if (venue?.telegram_bot_token) {
      const lines = items.map((i) => `• ${i.name} × ${i.qty} — ${formatPrice(i.price * i.qty, "UZS")}`);
      const fulfillmentLine =
        fulfillment === "delivery"
          ? `Доставка: ${address}`
          : fulfillment === "dine_in"
            ? `За столом: ${tableNumber}`
            : "Самовывоз";
      const discountLines = [
        appliedPromoCode ? `Промокод: ${appliedPromoCode} (-${formatPrice(promoDiscount, "UZS")})` : null,
        pointsRedeemed ? `Списано баллов: ${pointsRedeemed} (-${formatPrice(pointsDiscount, "UZS")})` : null,
      ].filter(Boolean);
      const text =
        `🛎 <b>Новый заказ</b> — ${venue.name}\n` +
        `🕐 Заказано в ${formatTime(new Date().toISOString())}\n\n` +
        `${lines.join("\n")}\n\n` +
        (discountLines.length ? `${discountLines.join("\n")}\n\n` : "") +
        `Итого: <b>${formatPrice(total, "UZS")}</b>\n\n` +
        `Имя: ${customerName}\nТелефон: ${phone}\n` +
        fulfillmentLine +
        (comment ? `\nКомментарий: ${comment}` : "");
      const context = fulfillment === "dine_in" ? `table|${tableNumber}` : fulfillment === "delivery" ? "delivery" : "";
      const markup = orderActionsMarkup(orderId, "new", context, resolveBotLang(venue.staff_bot_language));
      await notifyStaff(venue.telegram_bot_token, venueId, venue.telegram_chat_id, text, markup);
    }

    if (venue?.telegram_bot_token && customerTelegramChatId) {
      const [{ data: customerRow }, { data: orderRow }] = await Promise.all([
        adminDb
          .from("telegram_customers")
          .select("language")
          .eq("venue_id", venueId)
          .eq("chat_id", customerTelegramChatId)
          .maybeSingle(),
        adminDb.from("orders").select("order_number").eq("id", orderId).single(),
      ]);

      if (orderRow) {
        await sendOrderTracker({
          venueId,
          orderId,
          chatId: customerTelegramChatId,
          botToken: venue.telegram_bot_token,
          venueName: venue.name,
          orderNumber: orderRow.order_number,
          fulfillment,
          lang: resolveBotLang(customerRow?.language),
        });
      }
    }

    revalidatePath(`/admin/venues/${venueId}/orders`);
    revalidatePath("/cabinet/orders");
  });

  return { error: null, ok: true, orderId };
}

// Кабинет — простой бинарный переключатель "готово", в отличие от бота (там
// полная цепочка стадий, см. handleStageAdvance в webhook/[venueId]).
// "Готово" здесь = kitchen-стадия ready, снятие галочки откатывает в new.
export async function markOrderDone(venueId: string, orderId: string, done: boolean) {
  await advanceOrderStatus({ venueId, orderId, status: done ? "ready" : "new" });
  revalidatePath(`/admin/venues/${venueId}/orders`);
  revalidatePath("/cabinet/orders");
}

// Отмечает заказ отправленным — гостю уходит сообщение и планируется запрос
// отзыва через 30 минут (см. src/lib/order-status.ts).
export async function markOrderSent(venueId: string, orderId: string) {
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("sent_at").eq("id", orderId).maybeSingle();
  if (order?.sent_at) {
    revalidatePath(`/admin/venues/${venueId}/orders`);
    revalidatePath("/cabinet/orders");
    return;
  }

  await advanceOrderStatus({ venueId, orderId, status: "sent" });
  revalidatePath(`/admin/venues/${venueId}/orders`);
  revalidatePath("/cabinet/orders");
}

export async function deleteOrder(venueId: string, orderId: string) {
  const supabase = await createClient();
  // order_items has ON DELETE CASCADE on order_id, so this removes the items too.
  await supabase.from("orders").delete().eq("id", orderId);

  revalidatePath(`/admin/venues/${venueId}/orders`);
  revalidatePath("/cabinet/orders");
}

export async function deleteLoyaltyBalance(venueId: string, phone: string) {
  const supabase = await createClient();
  await supabase.from("loyalty_points").delete().eq("venue_id", venueId).eq("phone", phone);

  revalidatePath(`/admin/venues/${venueId}/loyalty`);
  revalidatePath("/cabinet/loyalty");
}
