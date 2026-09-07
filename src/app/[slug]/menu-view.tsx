"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, Phone, Clock, Camera, Send, Search, ChevronLeft, ShoppingBag, Plus, Minus, Bell, Moon, Sun } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { formatPrice, isOpenNow } from "@/lib/menu-utils";
import { CartProvider, useCart } from "@/lib/cart-context";
import { callWaiter } from "@/lib/waiter-actions";
import { getMenuTheme, loadThemePref, saveThemePref, type MenuTheme } from "@/lib/menu-theme";
import CartSheet from "./cart-sheet";

// Matches the explicit column list in page.tsx's getVenueData — deliberately
// excludes telegram_chat_id/telegram_connect_code, which must never reach
// this client component's serialized props.
type Venue = Pick<
  Tables<"venues">,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "logo_url"
  | "cover_url"
  | "address"
  | "phone"
  | "instagram"
  | "telegram"
  | "working_hours"
  | "languages"
  | "primary_color"
  | "accent_color"
  | "is_active"
  | "latitude"
  | "longitude"
  | "delivery_radius_km"
>;
type Category = Tables<"categories">;
type Dish = Tables<"dishes">;

const DICT = {
  ru: {
    open: "Открыто", closed: "Закрыто", new: "Новинка", popular: "Популярное", unavailable: "Нет в наличии", search: "Поиск блюд...", back: "Назад", cart: "Корзина",
    callWaiter: "Позвать официанта", callingWaiter: "Вызываем...", waiterCalled: "Официант уведомлён ✅", waiterCooldown: "Официант уже уведомлён",
    sharedCartHint: "👥 Общая корзина — всё, что добавляете, видят все за этим столом",
  },
  uz: {
    open: "Ochiq", closed: "Yopiq", new: "Yangi", popular: "Mashhur", unavailable: "Mavjud emas", search: "Taom qidirish...", back: "Orqaga", cart: "Savat",
    callWaiter: "Ofitsiantni chaqirish", callingWaiter: "Chaqirilmoqda...", waiterCalled: "Ofitsiant xabardor qilindi ✅", waiterCooldown: "Ofitsiant allaqachon xabardor",
    sharedCartHint: "👥 Umumiy savat — qo'shgan narsangizni shu stoldagi hamma ko'radi",
  },
};

export default function MenuView({
  venue,
  categories,
  dishes,
  source,
  table,
}: {
  venue: Venue;
  categories: Category[];
  dishes: Dish[];
  source?: string;
  table?: string;
}) {
  return (
    <CartProvider venueId={venue.id} table={table}>
      <MenuContent venue={venue} categories={categories} dishes={dishes} source={source} table={table} />
    </CartProvider>
  );
}

function MenuContent({
  venue,
  categories,
  dishes,
  source,
  table,
}: {
  venue: Venue;
  categories: Category[];
  dishes: Dish[];
  source?: string;
  table?: string;
}) {
  const cart = useCart();
  const [lang, setLang] = useState<"ru" | "uz">("ru");
  const [dark, setDark] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [waiterState, setWaiterState] = useState<"idle" | "calling" | "called" | "cooldown">("idle");
  const t = DICT[lang];
  const theme = getMenuTheme(dark);

  useEffect(() => {
    setDark(loadThemePref(venue.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTheme() {
    setDark((prev) => {
      const next = !prev;
      saveThemePref(venue.id, next);
      return next;
    });
  }

  async function handleCallWaiter() {
    if (waiterState !== "idle") return;
    setWaiterState("calling");
    try {
      const result = await callWaiter(venue.id, table);
      setWaiterState(result.alreadyCalled ? "cooldown" : "called");
    } catch {
      setWaiterState("idle");
      return;
    }
    // Matches the server's 2-minute cooldown window — lets the guest try
    // again after that instead of the button staying disabled until reload.
    setTimeout(() => setWaiterState("idle"), 2 * 60 * 1000);
  }
  const accent = venue.accent_color || "#c9722c";
  const open = isOpenNow((venue.working_hours as Record<string, string>) ?? {});

  useEffect(() => {
    fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venue_id: venue.id, event_type: "view" }),
    }).catch(() => {});
    if (source === "qr") {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venue_id: venue.id, event_type: "qr_scan" }),
      }).catch(() => {});
    }

    // No-op outside Telegram — window.Telegram is only defined when this
    // page is opened as the venue's bot's Mini App (see [slug]/page.tsx).
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
    // Без этого свайп вниз по меню закрывает весь Mini App — гость случайно
    // сворачивает приложение, листая список блюд. disableVerticalSwipes
    // (Bot API 7.7) убирает именно этот жест, requestFullscreen (8.0) ещё и
    // прячет шапку Telegram сверху. Оба метода есть не во всех клиентах —
    // isVersionAtLeast есть с 6.1, поэтому им можно проверять остальные.
    if (tg?.isVersionAtLeast?.("7.7")) tg.disableVerticalSwipes?.();
    if (tg?.isVersionAtLeast?.("8.0")) tg.requestFullscreen?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dishesByCategory = useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const d of dishes) {
      if (!map.has(d.category_id)) map.set(d.category_id, []);
      map.get(d.category_id)!.push(d);
    }
    return map;
  }, [dishes]);

  const categoryPhoto = (cat: Category) => cat.image_url ?? dishesByCategory.get(cat.id)?.[0]?.photo_url ?? null;

  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.trim().toLowerCase();
    return dishes.filter((d) => d.name.toLowerCase().includes(q) || d.name_uz?.toLowerCase().includes(q));
  }, [search, dishes]);

  const visibleDishes = searchResults ?? (activeCategory ? dishesByCategory.get(activeCategory.id) ?? [] : []);

  return (
    <div
      className="relative min-h-screen pb-28 transition-colors"
      style={{ ["--accent" as string]: accent, background: theme.bg, color: theme.text }}
    >
      {/* Cover + logo */}
      <div className="relative h-48 w-full overflow-hidden sm:h-60" style={{ background: theme.cardMuted }}>
        {venue.cover_url && (
          <Image src={venue.cover_url} alt={venue.name} fill sizes="100vw" priority className="object-cover" />
        )}
      </div>

      <div className="absolute right-3 top-3 flex gap-2">
        <button
          onClick={toggleTheme}
          aria-label={dark ? "Светлая тема" : "Тёмная тема"}
          className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
          style={{ background: theme.card, color: theme.text }}
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="relative -mt-10 flex justify-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 bg-white shadow-md" style={{ borderColor: theme.bg }}>
          {venue.logo_url && (
            <Image src={venue.logo_url} alt={venue.name} fill sizes="80px" className="object-cover" />
          )}
        </div>
      </div>

      <div className="px-4 pt-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold">{venue.name}</h1>
          {(venue.telegram || venue.instagram) && (
            <div className="flex gap-1.5">
              {venue.telegram && (
                <a
                  href={venue.telegram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm"
                  style={{ background: theme.card, color: theme.text }}
                >
                  <Send size={13} />
                </a>
              )}
              {venue.instagram && (
                <a
                  href={venue.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm"
                  style={{ background: theme.card, color: theme.text }}
                >
                  <Camera size={13} />
                </a>
              )}
            </div>
          )}
        </div>
        {venue.description && <p className="mt-1 text-sm" style={{ color: theme.muted }}>{venue.description}</p>}
        {table && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span
              className="inline-block rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: accent }}
            >
              Стол №{table}
            </span>
            <button
              onClick={handleCallWaiter}
              disabled={waiterState !== "idle"}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-70"
              style={{ borderColor: accent, color: waiterState === "idle" ? accent : theme.muted }}
            >
              <Bell size={12} />
              {waiterState === "idle" && t.callWaiter}
              {waiterState === "calling" && t.callingWaiter}
              {waiterState === "called" && t.waiterCalled}
              {waiterState === "cooldown" && t.waiterCooldown}
            </button>
          </div>
        )}
        {table && <p className="mt-1.5 text-[11px]" style={{ color: theme.muted }}>{t.sharedCartHint}</p>}
      </div>

      {venue.languages.length > 1 && (
        <div className="mt-3 flex justify-center">
          <div className="flex overflow-hidden rounded-full border text-xs shadow-sm" style={{ borderColor: theme.border, background: theme.card }}>
            <button
              onClick={() => setLang("ru")}
              aria-pressed={lang === "ru"}
              className="px-3 py-1"
              style={lang === "ru" ? { background: accent, color: "white" } : { color: theme.muted }}
            >
              RU
            </button>
            <button
              onClick={() => setLang("uz")}
              aria-pressed={lang === "uz"}
              className="px-3 py-1"
              style={lang === "uz" ? { background: accent, color: "white" } : { color: theme.muted }}
            >
              UZ
            </button>
          </div>
        </div>
      )}

      {/* Info card */}
      {(venue.address || venue.phone || open !== null) && (
        <div className="mx-4 mt-4 space-y-2 rounded-2xl p-4 text-sm shadow-sm" style={{ background: theme.card }}>
          {venue.address && (
            <div className="flex items-center gap-2" style={{ color: theme.text }}>
              <MapPin size={15} className="shrink-0" style={{ color: theme.muted }} /> {venue.address}
            </div>
          )}
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="flex items-center gap-2" style={{ color: theme.text }}>
              <Phone size={15} className="shrink-0" style={{ color: theme.muted }} /> {venue.phone}
            </a>
          )}
          {open !== null && (
            <div className="flex items-center gap-2">
              <Clock size={15} className="shrink-0" style={{ color: theme.muted }} />
              <span className={open ? "text-emerald-500" : "text-red-500"}>{open ? t.open : t.closed}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mx-4 mt-4">
        <div className="flex items-center gap-2 rounded-full border px-4 py-2.5 shadow-sm" style={{ borderColor: theme.border, background: theme.card }}>
          <Search size={16} style={{ color: theme.muted }} aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: theme.text }}
          />
        </div>
      </div>

      {/* Category pills */}
      {!search && (
        <div className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c)}
              className="shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition"
              style={
                activeCategory?.id === c.id
                  ? { background: accent, borderColor: accent, color: "white" }
                  : { borderColor: theme.border, color: theme.text, background: theme.card }
              }
            >
              {lang === "uz" && c.name_uz ? c.name_uz : c.name}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-4 pt-4">
        {search ? (
          <DishGrid dishes={visibleDishes} lang={lang} t={t} accent={accent} theme={theme} />
        ) : activeCategory ? (
          <>
            <button
              onClick={() => setActiveCategory(null)}
              className="mb-3 flex items-center gap-1 text-sm font-medium"
              style={{ color: theme.text }}
            >
              <ChevronLeft size={16} /> {t.back}
            </button>
            <h2 className="mb-3 text-lg font-semibold">
              {lang === "uz" && activeCategory.name_uz ? activeCategory.name_uz : activeCategory.name}
            </h2>
            <DishGrid dishes={visibleDishes} lang={lang} t={t} accent={accent} theme={theme} />
          </>
        ) : (
          <div className="space-y-4">
            {categories.map((c) => {
              const photo = categoryPhoto(c);
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c)}
                  className="relative block h-36 w-full overflow-hidden rounded-2xl text-left shadow-sm"
                >
                  {photo ? (
                    <Image
                      src={photo}
                      alt={c.name}
                      fill
                      sizes="(max-width: 640px) 100vw, 640px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      className="h-full w-full"
                      style={{ background: `linear-gradient(135deg, ${accent}, #7a5230)` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  <span className="absolute bottom-3 left-4 text-lg font-bold text-white drop-shadow">
                    {lang === "uz" && c.name_uz ? c.name_uz : c.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="mt-10 block text-center text-[11px] underline decoration-dotted underline-offset-2 transition"
        style={{ color: theme.mutedLight }}
      >
        ⚡ Работает на Menora — сделать такое же меню
      </a>

      {/* Sticky cart bar */}
      {cart.count > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-2xl px-5 py-3.5 text-sm font-semibold text-white shadow-lg"
          style={{ background: accent }}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag size={16} /> {t.cart} ({cart.count})
          </span>
          <span>{formatPrice(cart.total, cart.items[0]?.currency ?? "UZS")}</span>
        </button>
      )}

      {cartOpen && (
        <CartSheet
          venueId={venue.id}
          accent={accent}
          tableNumber={table}
          theme={theme}
          venueLocation={
            venue.latitude != null && venue.longitude != null
              ? { lat: venue.latitude, lng: venue.longitude, radiusKm: venue.delivery_radius_km }
              : null
          }
          onClose={() => setCartOpen(false)}
        />
      )}
    </div>
  );
}

function DishGrid({
  dishes,
  lang,
  t,
  accent,
  theme,
}: {
  dishes: Dish[];
  lang: "ru" | "uz";
  t: (typeof DICT)["ru"];
  accent: string;
  theme: MenuTheme;
}) {
  if (!dishes.length) {
    return <p className="py-8 text-center text-sm" style={{ color: theme.mutedLight }}>Ничего не найдено</p>;
  }

  return (
    <div className="space-y-3">
      {dishes.map((d) => (
        <DishCard key={d.id} dish={d} lang={lang} t={t} accent={accent} theme={theme} />
      ))}
    </div>
  );
}

function DishCard({
  dish,
  lang,
  t,
  accent,
  theme,
}: {
  dish: Dish;
  lang: "ru" | "uz";
  t: (typeof DICT)["ru"];
  accent: string;
  theme: MenuTheme;
}) {
  const cart = useCart();
  const name = lang === "uz" && dish.name_uz ? dish.name_uz : dish.name;
  const description = lang === "uz" && dish.description_uz ? dish.description_uz : dish.description;
  const qty = cart.qtyOf(dish.id);
  const price = dish.discount_price ?? dish.price;
  // is_available — ручной переключатель владельца, out_of_stock — авто по
  // остатку из Velora (см. syncVeloraStock). Гостю разница не важна, ему
  // важно можно ли заказать прямо сейчас.
  const available = dish.is_available && !dish.out_of_stock;

  return (
    <div
      className={`flex gap-3 overflow-hidden rounded-2xl p-3 shadow-sm ${!available ? "opacity-60" : ""}`}
      style={{ background: theme.card }}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl" style={{ background: theme.cardMuted }}>
        {dish.photo_url && (
          <Image src={dish.photo_url} alt={name} fill sizes="96px" className="object-cover" />
        )}
        <div className="absolute left-1 top-1 flex flex-col gap-1">
          {dish.is_new && <Badge color="bg-sky-500">{t.new}</Badge>}
          {dish.is_popular && <Badge color="" style={{ background: accent }}>{t.popular}</Badge>}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <p className="truncate text-sm font-semibold">{name}</p>
          {description && <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: theme.muted }}>{description}</p>}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {dish.discount_price != null ? (
              <>
                <span className="mr-1.5 text-xs font-normal line-through" style={{ color: theme.mutedLight }}>
                  {formatPrice(dish.price, dish.currency)}
                </span>
                <span style={{ color: accent }}>{formatPrice(dish.discount_price, dish.currency)}</span>
              </>
            ) : (
              formatPrice(dish.price, dish.currency)
            )}
          </p>

          {available &&
            (qty === 0 ? (
              <button
                onClick={() => cart.addItem({ dishId: dish.id, name, price, currency: dish.currency })}
                aria-label={`${name}: +1`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                style={{ background: accent }}
              >
                <Plus size={14} />
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => cart.setQty(dish.id, qty - 1)}
                  aria-label={`${name}: -1`}
                  className="flex h-7 w-7 items-center justify-center rounded-full border"
                  style={{ borderColor: theme.border, color: theme.text }}
                >
                  <Minus size={13} />
                </button>
                <span className="w-4 text-center text-sm font-medium">{qty}</span>
                <button
                  onClick={() => cart.setQty(dish.id, qty + 1)}
                  aria-label={`${name}: +1`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                  style={{ background: accent }}
                >
                  <Plus size={13} />
                </button>
              </div>
            ))}
        </div>
        {!available && <p className="mt-1 text-[11px] text-red-500">{t.unavailable}</p>}
      </div>
    </div>
  );
}

function Badge({ children, color, style }: { children: React.ReactNode; color: string; style?: React.CSSProperties }) {
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white ${color}`} style={style}>
      {children}
    </span>
  );
}
