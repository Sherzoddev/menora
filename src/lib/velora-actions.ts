// Интеграция с Velora (касса заведения, отдельный проект/Supabase) — заказ,
// оформленный в Меноре, открывает счёт («стол»/«доставка») у кассира в
// Velora так же, как если бы он открыл его сам. Velora ничего не знает про
// Менору — со стороны Velora это обычный клиент с токеном заведения,
// абсолютно так же, как её собственная касса (см. web/src/lib/supabase.ts
// в проекте shaurma). Схему Velora не меняем и не трогаем.
//
// Сопоставление товаров — по id (dishes.velora_product_id), не по названию:
// сравнение текста хрупкое (лишний пробел/буква — и совпадение молча не
// находится, склад не списывается). Импорт (importVeloraProducts ниже)
// один раз копирует товары из Velora в Менору с привязкой по id — дальше
// заказ просто переносит этот id, сравнивать текст не нужно вообще.
// Позиция без привязки (импорт не запускали, товар добавлен руками) всё
// равно попадёт в Velora текстом с той же суммой, просто без списания
// склада — как ручная позиция в кассе.

import { createAdminClient } from "@/lib/supabase/admin";

const VELORA_URL = "https://qzhvtufjqaaeyzbycidf.supabase.co";
const VELORA_ANON_KEY = "sb_publishable_6QwVueO_5Wza0t8LJkakmA_AEswjAkP";

export type VeloraItem = { name: string; price: number; qty: number; veloraProductId: string | null };

function veloraHeaders(token: string, extra?: Record<string, string>): HeadersInit {
  return {
    apikey: VELORA_ANON_KEY,
    Authorization: `Bearer ${VELORA_ANON_KEY}`,
    "x-venue-token": token,
    "Content-Type": "application/json",
    ...extra,
  };
}

/** Префикс "Menora:" — баннер "Зовут кассира" в Velora показывает только
 * label (см. CashierCalls.tsx), без него кассир не отличит заказ из Меноры
 * от обычного заказа, открытого прямо в кассе. */
function veloraLabel(fulfillment: string, tableNumber: string): string {
  if (fulfillment === "dine_in") return `Menora: Стол ${tableNumber}`;
  if (fulfillment === "delivery") return "Menora: Доставка";
  return "Menora: Самовывоз";
}

/** cost нужен только для отчёта по прибыли в Velora — запрашиваем его только
 * для товаров, которые реально есть в этом заказе, не весь каталог. */
async function fetchCosts(token: string, productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const res = await fetch(
    `${VELORA_URL}/rest/v1/products?select=id,cost&id=in.(${productIds.join(",")})`,
    { headers: veloraHeaders(token), cache: "no-store" },
  );
  if (!res.ok) return new Map();
  const rows: { id: string; cost: number }[] = await res.json().catch(() => []);
  return new Map(rows.map((r) => [r.id, r.cost]));
}

/**
 * Best-effort: сбой Velora (сеть, неверный/отозванный токен) не должен
 * ломать оформление заказа гостю в Меноре — ошибка только логируется.
 */
export async function pushOrderToVelora(params: {
  veloraVenueId: string;
  veloraToken: string;
  fulfillment: string;
  tableNumber: string;
  items: VeloraItem[];
  customerName: string;
  /** Скидка (промокод + списанные баллы), уже вычтена из total в заказе
   * Меноры — кассир Velora должен увидеть ту же сумму, а не полную цену. */
  discount: number;
}): Promise<void> {
  const { veloraVenueId, veloraToken, fulfillment, tableNumber, items, customerName, discount } = params;
  try {
    const productIds = [...new Set(items.map((i) => i.veloraProductId).filter((id): id is string => !!id))];
    const costs = await fetchCosts(veloraToken, productIds);
    const now = new Date().toISOString();
    const tabId = crypto.randomUUID();

    const tabRes = await fetch(`${VELORA_URL}/rest/v1/tabs?on_conflict=id`, {
      method: "POST",
      headers: veloraHeaders(veloraToken, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({
        id: tabId,
        venue_id: veloraVenueId,
        label: veloraLabel(fulfillment, tableNumber),
        user_name: customerName ? `Menora — ${customerName}` : "Menora",
        opened_at: now,
        status: "open",
        closed_at: null,
        // Доставку/самовывоз кассиру нужно увидеть сразу, а не когда стол
        // "накопится" — за столом же гость может ещё дозаказывать.
        ready_for_payment: fulfillment !== "dine_in",
        discount,
      }),
    });
    if (!tabRes.ok) throw new Error(`tabs: ${tabRes.status} ${await tabRes.text()}`);

    const itemRows = items.map((i) => ({
      id: crypto.randomUUID(),
      venue_id: veloraVenueId,
      tab_id: tabId,
      product_id: i.veloraProductId,
      name: i.name,
      price: i.price,
      cost: i.veloraProductId ? (costs.get(i.veloraProductId) ?? 0) : 0,
      qty: i.qty,
      comment: null,
      added_at: now,
    }));

    const itemsRes = await fetch(`${VELORA_URL}/rest/v1/tab_items?on_conflict=id`, {
      method: "POST",
      headers: veloraHeaders(veloraToken, { Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(itemRows),
    });
    if (!itemsRes.ok) throw new Error(`tab_items: ${itemsRes.status} ${await itemsRes.text()}`);
  } catch (err) {
    console.error("[velora] failed to push order", err);
  }
}

type VeloraCategory = { id: string; name: string };
type VeloraProduct = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  active: boolean;
  image_url: string | null;
};

async function fetchVeloraCatalog(
  token: string,
): Promise<{ categories: VeloraCategory[]; products: VeloraProduct[] }> {
  const [catRes, prodRes] = await Promise.all([
    fetch(`${VELORA_URL}/rest/v1/categories?select=id,name&deleted=eq.false`, {
      headers: veloraHeaders(token),
      cache: "no-store",
    }),
    fetch(`${VELORA_URL}/rest/v1/products?select=id,name,price,category_id,active,image_url&deleted=eq.false&active=eq.true`, {
      headers: veloraHeaders(token),
      cache: "no-store",
    }),
  ]);
  if (!catRes.ok) throw new Error(`categories: ${catRes.status} ${await catRes.text()}`);
  if (!prodRes.ok) throw new Error(`products: ${prodRes.status} ${await prodRes.text()}`);
  return { categories: await catRes.json(), products: await prodRes.json() };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Фото Velora лежит на её собственном Supabase-хранилище — другой домен,
 * Next.js Image в Меноре его не покажет (см. next.config.ts, разрешён
 * только свой домен), да и ссылаться на чужое хранилище навсегда не дело:
 * удалят/поменяют там — пропадёт и тут. Поэтому скачиваем и заливаем к
 * себе, в тот же бакет menora-media, что и логотипы/обложки заведений.
 */
async function copyImageToMenoraStorage(
  supabase: ReturnType<typeof createAdminClient>,
  imageUrl: string,
  menoraVenueId: string,
  veloraProductId: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const blob = await res.blob();
    const path = `venues/${menoraVenueId}/dishes/velora-${veloraProductId}.${ext}`;
    const { error } = await supabase.storage.from("menora-media").upload(path, blob, { upsert: true, contentType });
    if (error) return null;
    const { data } = supabase.storage.from("menora-media").getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch {
    return null;
  }
}

/**
 * Копирует каталог из Velora в блюда Меноры (создаёт недостающие, обновляет
 * название/цену у уже импортированных ранее — узнаёт их по velora_product_id,
 * повторный запуск синхронизирует, а не плодит дубли). Категории Velora
 * сопоставляются с категориями Меноры по названию, недостающие создаются.
 * Товары, добавленные в Меноре вручную (без привязки), не трогает.
 */
export async function importVeloraProducts(params: {
  menoraVenueId: string;
  veloraVenueId: string;
  veloraToken: string;
}): Promise<{ createdDishes: number; updatedDishes: number; createdCategories: number }> {
  const { menoraVenueId, veloraToken } = params;
  const supabase = createAdminClient();

  const { categories: veloraCategories, products: veloraProducts } = await fetchVeloraCatalog(veloraToken);

  const { data: existingCategories, error: catErr } = await supabase
    .from("categories")
    .select("id, name")
    .eq("venue_id", menoraVenueId);
  if (catErr) throw new Error(`menora categories: ${catErr.message}`);

  const categoryByName = new Map((existingCategories ?? []).map((c) => [normalizeName(c.name), c.id]));
  const veloraCategoryById = new Map(veloraCategories.map((c) => [c.id, c]));

  let createdCategories = 0;
  let sortCursor = existingCategories?.length ?? 0;

  // find-or-create категории для каждой встреченной в товарах Velora — по
  // одной, не пачкой: insert может конфликтовать по имени, дешевле и
  // надёжнее на десятке категорий, чем городить batch-upsert без уникального
  // индекса на (venue_id, name).
  async function resolveCategoryId(veloraCategoryId: string | null): Promise<string | null> {
    const veloraCategory = veloraCategoryId ? veloraCategoryById.get(veloraCategoryId) : null;
    const name = veloraCategory?.name?.trim() || "Без категории";
    const key = normalizeName(name);
    const existing = categoryByName.get(key);
    if (existing) return existing;

    const { data, error } = await supabase
      .from("categories")
      .insert({ venue_id: menoraVenueId, name, sort_order: sortCursor++ })
      .select("id")
      .single();
    if (error || !data) return null;
    categoryByName.set(key, data.id);
    createdCategories++;
    return data.id;
  }

  const { data: existingDishes, error: dishErr } = await supabase
    .from("dishes")
    .select("id, velora_product_id, photo_url")
    .eq("venue_id", menoraVenueId)
    .not("velora_product_id", "is", null);
  if (dishErr) throw new Error(`menora dishes: ${dishErr.message}`);
  const dishByVeloraId = new Map(
    (existingDishes ?? []).map((d) => [d.velora_product_id as string, { id: d.id, photoUrl: d.photo_url }]),
  );

  let createdDishes = 0;
  let updatedDishes = 0;

  for (const product of veloraProducts) {
    const categoryId = await resolveCategoryId(product.category_id);
    if (!categoryId) continue;

    const existingDish = dishByVeloraId.get(product.id);
    if (existingDish) {
      // Фото не перезаписываем при повторном импорте, если оно уже
      // скопировано (или заменено вручную в Меноре) — только имя/цена
      // синхронизируются каждый раз, фото трогаем лишь если его нет вовсе.
      const photoUrl = !existingDish.photoUrl && product.image_url
        ? await copyImageToMenoraStorage(supabase, product.image_url, menoraVenueId, product.id)
        : undefined;
      const { error } = await supabase
        .from("dishes")
        .update({
          name: product.name,
          price: product.price,
          category_id: categoryId,
          ...(photoUrl ? { photo_url: photoUrl } : {}),
        })
        .eq("id", existingDish.id);
      if (!error) updatedDishes++;
    } else {
      const photoUrl = product.image_url
        ? await copyImageToMenoraStorage(supabase, product.image_url, menoraVenueId, product.id)
        : null;
      const { error } = await supabase.from("dishes").insert({
        venue_id: menoraVenueId,
        category_id: categoryId,
        name: product.name,
        price: product.price,
        velora_product_id: product.id,
        photo_url: photoUrl,
      });
      if (!error) createdDishes++;
    }
  }

  return { createdDishes, updatedDishes, createdCategories };
}

/**
 * Для всех подключённых заведений подтягивает текущий остаток из Velora по
 * блюдам, импортированным оттуда (у которых есть velora_product_id), и
 * проставляет out_of_stock = остаток <= 0. Вызывается по расписанию
 * (см. src/app/api/cron/sync-stock) — сама Velora Менору не уведомляет,
 * поэтому это опрос, а не мгновенная реакция; задержка = интервал крона.
 */
export async function syncVeloraStock(): Promise<{ venuesChecked: number; dishesUpdated: number }> {
  const supabase = createAdminClient();

  const { data: venues, error: venuesError } = await supabase
    .from("venues")
    .select("id, velora_venue_id, velora_token")
    .not("velora_venue_id", "is", null)
    .not("velora_token", "is", null);
  if (venuesError) throw new Error(`venues: ${venuesError.message}`);

  let dishesUpdated = 0;

  for (const venue of venues ?? []) {
    if (!venue.velora_token) continue;

    const { data: dishes, error: dishesError } = await supabase
      .from("dishes")
      .select("id, out_of_stock, velora_product_id")
      .eq("venue_id", venue.id)
      .not("velora_product_id", "is", null);
    if (dishesError || !dishes || dishes.length === 0) continue;

    const productIds = dishes.map((d) => d.velora_product_id as string);
    const res = await fetch(
      `${VELORA_URL}/rest/v1/products?select=id,stock&id=in.(${productIds.join(",")})`,
      { headers: veloraHeaders(venue.velora_token), cache: "no-store" },
    );
    if (!res.ok) continue;
    const stockRows: { id: string; stock: number }[] = await res.json().catch(() => []);
    const stockById = new Map(stockRows.map((r) => [r.id, r.stock]));

    for (const dish of dishes) {
      // Товар удалили/скрыли в Velora — считаем, что его больше нет, а не
      // "неизвестно" (иначе удалённый в Velora товар остался бы видимым тут).
      const stock = stockById.get(dish.velora_product_id as string) ?? 0;
      const shouldBeOutOfStock = stock <= 0;
      if (dish.out_of_stock !== shouldBeOutOfStock) {
        const { error } = await supabase.from("dishes").update({ out_of_stock: shouldBeOutOfStock }).eq("id", dish.id);
        if (!error) dishesUpdated++;
      }
    }
  }

  return { venuesChecked: (venues ?? []).length, dishesUpdated };
}
