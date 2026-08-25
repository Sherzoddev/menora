"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MapPin, Phone, Clock, Camera, Send, Search, ChevronLeft, ShoppingBag, Plus, Minus, Bell } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { formatPrice, isOpenNow } from "@/lib/menu-utils";
import { CartProvider, useCart } from "@/lib/cart-context";
import { callWaiter } from "@/lib/waiter-actions";
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
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [waiterState, setWaiterState] = useState<"idle" | "calling" | "called" | "cooldown">("idle");
  const t = DICT[lang];

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
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
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
    <div className="min-h-screen bg-[#FBF3E6] pb-28 text-[#3a2f22]" style={{ ["--accent" as string]: accent }}>
      {/* Cover + logo */}
      <div className="relative h-48 w-full overflow-hidden bg-[#e7ddcd] sm:h-60">
        {venue.cover_url && (
          <Image src={venue.cover_url} alt={venue.name} fill sizes="100vw" priority className="object-cover" />
        )}
      </div>

      <div className="relative -mt-10 flex justify-center">
        <div className="relative h-20 w-20 overflow-hidden rounded-full border-4 border-[#FBF3E6] bg-white shadow-md">
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
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#3a2f22] shadow-sm"
                >
                  <Send size={13} />
                </a>
              )}
              {venue.instagram && (
                <a
                  href={venue.instagram}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#3a2f22] shadow-sm"
                >
                  <Camera size={13} />
                </a>
              )}
            </div>
          )}
        </div>
        {venue.description && <p className="mt-1 text-sm text-[#8a7a63]">{venue.description}</p>}
        {table && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
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
              style={{ borderColor: accent, color: waiterState === "idle" ? accent : "#8a7a63" }}
            >
              <Bell size={12} />
              {waiterState === "idle" && t.callWaiter}
              {waiterState === "calling" && t.callingWaiter}
              {waiterState === "called" && t.waiterCalled}
              {waiterState === "cooldown" && t.waiterCooldown}
            </button>
          </div>
        )}
        {table && <p className="mt-1.5 text-[11px] text-[#8a7a63]">{t.sharedCartHint}</p>}
      </div>

      {venue.languages.length > 1 && (
        <div className="mt-3 flex justify-center">
          <div className="flex overflow-hidden rounded-full border border-[#e7ddcd] bg-white text-xs shadow-sm">
            <button
              onClick={() => setLang("ru")}
              aria-pressed={lang === "ru"}
              className="px-3 py-1"
              style={lang === "ru" ? { background: accent, color: "white" } : { color: "#8a7a63" }}
            >
              RU
            </button>
            <button
              onClick={() => setLang("uz")}
              aria-pressed={lang === "uz"}
              className="px-3 py-1"
              style={lang === "uz" ? { background: accent, color: "white" } : { color: "#8a7a63" }}
            >
              UZ
            </button>
          </div>
        </div>
      )}

      {/* Info card */}
      {(venue.address || venue.phone || open !== null) && (
        <div className="mx-4 mt-4 space-y-2 rounded-2xl bg-white p-4 text-sm shadow-sm">
          {venue.address && (
            <div className="flex items-center gap-2 text-[#5a4d3c]">
              <MapPin size={15} className="shrink-0 text-[#8a7a63]" /> {venue.address}
            </div>
          )}
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="flex items-center gap-2 text-[#5a4d3c]">
              <Phone size={15} className="shrink-0 text-[#8a7a63]" /> {venue.phone}
            </a>
          )}
          {open !== null && (
            <div className="flex items-center gap-2">
              <Clock size={15} className="shrink-0 text-[#8a7a63]" />
              <span className={open ? "text-emerald-600" : "text-red-500"}>{open ? t.open : t.closed}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="mx-4 mt-4">
        <div className="flex items-center gap-2 rounded-full border border-[#e7ddcd] bg-white px-4 py-2.5 shadow-sm">
          <Search size={16} className="text-[#8a7a63]" aria-hidden />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
            aria-label={t.search}
            className="w-full bg-transparent text-sm outline-none placeholder:text-[#b3a48c]"
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
                  : { borderColor: "#e7ddcd", color: "#5a4d3c", background: "white" }
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
          <DishGrid dishes={visibleDishes} lang={lang} t={t} accent={accent} />
        ) : activeCategory ? (
          <>
            <button
              onClick={() => setActiveCategory(null)}
              className="mb-3 flex items-center gap-1 text-sm font-medium text-[#5a4d3c]"
            >
              <ChevronLeft size={16} /> {t.back}
            </button>
            <h2 className="mb-3 text-lg font-semibold">
              {lang === "uz" && activeCategory.name_uz ? activeCategory.name_uz : activeCategory.name}
            </h2>
            <DishGrid dishes={visibleDishes} lang={lang} t={t} accent={accent} />
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
        className="mt-10 block text-center text-[11px] text-[#c2b394] underline decoration-dotted underline-offset-2 transition hover:text-[#8a7a63]"
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
        <CartSheet venueId={venue.id} accent={accent} tableNumber={table} onClose={() => setCartOpen(false)} />
      )}
    </div>
  );
}

function DishGrid({
  dishes,
  lang,
  t,
  accent,
}: {
  dishes: Dish[];
  lang: "ru" | "uz";
  t: (typeof DICT)["ru"];
  accent: string;
}) {
  if (!dishes.length) {
    return <p className="py-8 text-center text-sm text-[#b3a48c]">Ничего не найдено</p>;
  }

  return (
    <div className="space-y-3">
      {dishes.map((d) => (
        <DishCard key={d.id} dish={d} lang={lang} t={t} accent={accent} />
      ))}
    </div>
  );
}

function DishCard({
  dish,
  lang,
  t,
  accent,
}: {
  dish: Dish;
  lang: "ru" | "uz";
  t: (typeof DICT)["ru"];
  accent: string;
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
    <div className={`flex gap-3 overflow-hidden rounded-2xl bg-white p-3 shadow-sm ${!available ? "opacity-60" : ""}`}>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#f1e9da]">
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
          {description && <p className="mt-0.5 line-clamp-2 text-xs text-[#8a7a63]">{description}</p>}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {dish.discount_price != null ? (
              <>
                <span className="mr-1.5 text-xs font-normal text-[#b3a48c] line-through">
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
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e7ddcd]"
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
