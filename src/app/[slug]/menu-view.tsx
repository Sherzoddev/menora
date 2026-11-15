"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Bell,
  Camera,
  Flame,
  MapPin,
  Minus,
  Moon,
  Phone,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Sun,
  X,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { formatPrice, isOpenNow } from "@/lib/menu-utils";
import { CartProvider, useCart } from "@/lib/cart-context";
import { callWaiter } from "@/lib/waiter-actions";
import { getMenuTheme, loadThemePref, saveThemePref, themeVars } from "@/lib/menu-theme";
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
type Lang = "ru" | "uz";

const DICT = {
  ru: {
    open: "Открыто", closed: "Закрыто", new: "Новинка", popular: "Хит", unavailable: "Нет в наличии", search: "Поиск блюд", cart: "Корзина",
    popularTitle: "Популярное", notFound: "Ничего не найдено", add: "Добавить", table: "Стол",
    callWaiter: "Позвать официанта", callingWaiter: "Вызываем...", waiterCalled: "Официант уведомлён ✅", waiterCooldown: "Официант уже уведомлён",
    sharedCartHint: "Общая корзина — всё, что добавляете, видят все за этим столом",
    poweredBy: "Работает на Menora — сделать такое же меню",
  },
  uz: {
    open: "Ochiq", closed: "Yopiq", new: "Yangi", popular: "Xit", unavailable: "Mavjud emas", search: "Taom qidirish", cart: "Savat",
    popularTitle: "Mashhur", notFound: "Hech narsa topilmadi", add: "Qo'shish", table: "Stol",
    callWaiter: "Ofitsiantni chaqirish", callingWaiter: "Chaqirilmoqda...", waiterCalled: "Ofitsiant xabardor qilindi ✅", waiterCooldown: "Ofitsiant allaqachon xabardor",
    sharedCartHint: "Umumiy savat — qo'shgan narsangizni shu stoldagi hamma ko'radi",
    poweredBy: "Menora'da ishlaydi — shunday menyu yaratish",
  },
};
type Dict = (typeof DICT)["ru"];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function todayHours(workingHours: Record<string, string> | null): string | null {
  if (!workingHours) return null;
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent" }));
  return workingHours[DAY_KEYS[now.getDay()]]?.replace(/\s*-\s*/, "–") ?? null;
}

const dishName = (d: Dish, lang: Lang) => (lang === "uz" && d.name_uz ? d.name_uz : d.name);
const dishDescription = (d: Dish, lang: Lang) => (lang === "uz" && d.description_uz ? d.description_uz : d.description);
const categoryName = (c: Category, lang: Lang) => (lang === "uz" && c.name_uz ? c.name_uz : c.name);
// is_available — ручной переключатель владельца, out_of_stock — авто по
// остатку из Velora (см. syncVeloraStock). Гостю разница не важна, ему
// важно можно ли заказать прямо сейчас.
const isOrderable = (d: Dish) => d.is_available && !d.out_of_stock;

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
  const [lang, setLang] = useState<Lang>("ru");
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openDish, setOpenDish] = useState<Dish | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [waiterState, setWaiterState] = useState<"idle" | "calling" | "called" | "cooldown">("idle");
  const navRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  // Пока страница едет к выбранной категории, подсветку вкладок не трогаем —
  // иначе она пробегает по всем категориям по пути.
  const spyLocked = useRef(false);
  const t = DICT[lang];
  const theme = getMenuTheme(dark);
  const accent = venue.accent_color || "#c9722c";
  const workingHours = (venue.working_hours as Record<string, string> | null) ?? null;
  const open = isOpenNow(workingHours ?? {});
  const hours = todayHours(workingHours);

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
    //
    // Скрипт Telegram грузится с strategy="lazyOnload", то есть ПОСЛЕ этого
    // эффекта — раньше window.Telegram в этот момент часто ещё не было, вызовы
    // молча пропускались, и свайп вниз сворачивал/закрывал приложение.
    // Поэтому ждём появления SDK и настраиваем окно, как только он готов.
    let attempts = 0;
    let done = false;
    const setup = () => {
      const tg = window.Telegram?.WebApp;
      if (!tg || done) return !!tg;
      done = true;
      tg.ready();
      tg.expand();
      // disableVerticalSwipes (Bot API 7.7) убирает жест «потянуть вниз —
      // свернуть Mini App», requestFullscreen (8.0) ещё и прячет шапку
      // Telegram. Есть не во всех клиентах — проверяем версию.
      if (tg.isVersionAtLeast?.("7.7")) tg.disableVerticalSwipes?.();
      if (tg.isVersionAtLeast?.("8.0")) tg.requestFullscreen?.();
      return true;
    };
    let timer: number | undefined;
    if (!setup()) {
      timer = window.setInterval(() => {
        if (setup() || ++attempts > 150) window.clearInterval(timer);
      }, 100);
    }
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Всё меню — одна лента: категории идут друг за другом, вкладки сверху
  // только прокручивают к нужной и подсвечивают текущую.
  const sections = useMemo(() => {
    const byCategory = new Map<string, Dish[]>();
    for (const d of dishes) {
      if (!byCategory.has(d.category_id)) byCategory.set(d.category_id, []);
      byCategory.get(d.category_id)!.push(d);
    }
    return categories
      .map((category) => ({ category, dishes: byCategory.get(category.id) ?? [] }))
      .filter((s) => s.dishes.length > 0);
  }, [categories, dishes]);

  const popular = useMemo(
    () => dishes.filter((d) => d.is_popular && d.photo_url && isOrderable(d)).slice(0, 10),
    [dishes],
  );

  const photos = useMemo(() => new Map(dishes.map((d) => [d.id, d.photo_url])), [dishes]);

  const query = search.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!query) return null;
    return dishes.filter((d) => d.name.toLowerCase().includes(query) || d.name_uz?.toLowerCase().includes(query));
  }, [query, dishes]);

  const sectionKey = sections.map((s) => s.category.id).join(",");
  useEffect(() => {
    if (searchResults) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-cat]"));
    if (!els.length) return;
    const onScroll = () => {
      if (spyLocked.current) return;
      const line = (navRef.current?.offsetHeight ?? 64) + 24;
      let current = els[0].dataset.cat ?? null;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= line) current = el.dataset.cat ?? current;
      }
      setActiveId(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey, !!searchResults]);

  // Активная вкладка всегда видна в горизонтальной ленте вкладок.
  useEffect(() => {
    const strip = tabsRef.current;
    const tab = strip?.querySelector<HTMLElement>(`[data-tab="${activeId}"]`);
    if (!strip || !tab) return;
    strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: "smooth" });
  }, [activeId]);

  function goToCategory(id: string) {
    const el = document.getElementById(`cat-${id}`);
    if (!el) return;
    spyLocked.current = true;
    window.setTimeout(() => {
      spyLocked.current = false;
    }, 900);
    setActiveId(id);
    const offset = (navRef.current?.offsetHeight ?? 64) + 8;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  }

  function closeSearch() {
    setSearch("");
    setSearchOpen(false);
  }

  const venueMapUrl =
    venue.latitude != null && venue.longitude != null
      ? `https://maps.google.com/?q=${venue.latitude},${venue.longitude}`
      : venue.address
        ? `https://maps.google.com/?q=${encodeURIComponent(venue.address)}`
        : null;

  return (
    <div className="mn-root min-h-screen transition-colors" style={themeVars(theme, accent)}>
      <div className="relative mx-auto w-full max-w-xl pb-32">
        {/* Обложка */}
        <div className="relative h-56 w-full overflow-hidden sm:h-72 sm:rounded-b-[32px]">
          {venue.cover_url ? (
            <Image src={venue.cover_url} alt={venue.name} fill sizes="(max-width: 640px) 100vw, 576px" priority className="object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background: `radial-gradient(120% 90% at 15% 10%, color-mix(in srgb, ${accent} 70%, #fff) 0%, ${accent} 45%, color-mix(in srgb, ${accent} 55%, #000) 100%)`,
              }}
            />
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--mn-bg)] to-transparent" />
        </div>

        <div
          className="absolute right-3 top-0 z-10 flex items-center gap-2"
          style={{ paddingTop: "calc(12px + var(--mn-safe-top))" }}
        >
          {venue.languages.length > 1 && (
            <div className="flex rounded-full bg-black/45 p-1 text-[12px] font-bold text-white backdrop-blur-md">
              {(["ru", "uz"] as const).map((code) => (
                <button
                  key={code}
                  onClick={() => setLang(code)}
                  aria-pressed={lang === code}
                  className={`rounded-full px-3 py-1.5 uppercase transition ${lang === code ? "bg-white text-black" : ""}`}
                >
                  {code}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={toggleTheme}
            aria-label={dark ? "Светлая тема" : "Тёмная тема"}
            className="mn-press flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        {/* Заведение */}
        <div className="relative -mt-12 px-4">
          <div className="flex items-end justify-between gap-3">
            <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[26px] border-4 border-[color:var(--mn-bg)] bg-[var(--mn-card)] shadow-lg">
              {venue.logo_url ? (
                <Image src={venue.logo_url} alt="" fill sizes="88px" className="object-cover" />
              ) : (
                <span className="mn-display flex h-full w-full items-center justify-center bg-[var(--mn-accent)] text-3xl font-black text-[color:var(--mn-on-accent)]">
                  {venue.name.slice(0, 1)}
                </span>
              )}
            </div>
            {open !== null && (
              <span className="mb-1 flex items-center gap-2 rounded-full bg-[var(--mn-card)] px-3.5 py-2 text-[13px] font-semibold shadow-sm">
                <span className={`h-2 w-2 rounded-full ${open ? "bg-emerald-500" : "bg-red-500"}`} />
                {open ? t.open : t.closed}
                {hours && <span className="font-normal text-[color:var(--mn-muted)]">{hours}</span>}
              </span>
            )}
          </div>

          <h1 className="mn-display mt-3.5 text-[28px] font-black leading-[1.05]">{venue.name}</h1>
          {venue.description && (
            <p className="mt-2 text-[14px] leading-snug text-[color:var(--mn-muted)]">{venue.description}</p>
          )}

          {(venue.address || venue.phone || venue.telegram || venue.instagram) && (
            <div className="mn-noscroll -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4">
              {venue.address && (
                <InfoChip href={venueMapUrl} external>
                  <MapPin size={15} /> {venue.address}
                </InfoChip>
              )}
              {venue.phone && (
                <InfoChip href={`tel:${venue.phone}`}>
                  <Phone size={15} /> {venue.phone}
                </InfoChip>
              )}
              {venue.telegram && (
                <InfoChip href={venue.telegram} external>
                  <Send size={15} /> Telegram
                </InfoChip>
              )}
              {venue.instagram && (
                <InfoChip href={venue.instagram} external>
                  <Camera size={15} /> Instagram
                </InfoChip>
              )}
            </div>
          )}

          {table && (
            <div className="mt-4 rounded-[22px] bg-[var(--mn-card)] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="mn-display rounded-2xl bg-[var(--mn-accent)] px-3.5 py-2 text-[14px] font-bold text-[color:var(--mn-on-accent)]">
                  {t.table} №{table}
                </span>
                <button
                  onClick={handleCallWaiter}
                  disabled={waiterState !== "idle"}
                  className="mn-press flex items-center gap-2 rounded-2xl border-[1.5px] border-[color:var(--mn-border)] px-3.5 py-2 text-[13px] font-semibold disabled:text-[color:var(--mn-muted)]"
                >
                  <Bell size={15} />
                  {waiterState === "idle" && t.callWaiter}
                  {waiterState === "calling" && t.callingWaiter}
                  {waiterState === "called" && t.waiterCalled}
                  {waiterState === "cooldown" && t.waiterCooldown}
                </button>
              </div>
              <p className="mt-2.5 text-[12px] leading-snug text-[color:var(--mn-muted)]">{t.sharedCartHint}</p>
            </div>
          )}
        </div>

        {/* Вкладки категорий + поиск: прилипают к верху */}
        <div
          ref={navRef}
          className="sticky top-0 z-30 mt-4 border-b border-[color:var(--mn-border)] backdrop-blur-xl"
          style={{
            paddingTop: "var(--mn-safe-top)",
            background: "color-mix(in srgb, var(--mn-bg) 86%, transparent)",
          }}
        >
          {searchOpen ? (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <div className="flex flex-1 items-center gap-2 rounded-full bg-[var(--mn-card)] px-4 py-2.5">
                <Search size={17} className="shrink-0 text-[color:var(--mn-muted)]" aria-hidden />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.search}
                  aria-label={t.search}
                  className="w-full bg-transparent text-[16px] outline-none placeholder:text-[color:var(--mn-muted-light)]"
                />
              </div>
              <button
                onClick={closeSearch}
                aria-label="Закрыть поиск"
                className="mn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mn-card)]"
              >
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2.5 pl-4">
              <button
                onClick={() => setSearchOpen(true)}
                aria-label={t.search}
                className="mn-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--mn-card)]"
              >
                <Search size={17} />
              </button>
              <div ref={tabsRef} className="mn-noscroll relative flex flex-1 gap-1.5 overflow-x-auto pr-4">
                {sections.map(({ category }) => {
                  const active = activeId === category.id;
                  return (
                    <button
                      key={category.id}
                      data-tab={category.id}
                      onClick={() => goToCategory(category.id)}
                      className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                        active
                          ? "bg-[var(--mn-text)] text-[color:var(--mn-bg)]"
                          : "bg-[var(--mn-card)] text-[color:var(--mn-text)]"
                      }`}
                    >
                      {categoryName(category, lang)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Лента меню */}
        <div className="px-4 pt-5">
          {searchResults ? (
            searchResults.length ? (
              <div className="grid grid-cols-2 gap-3">
                {searchResults.map((d) => (
                  <DishCard key={d.id} dish={d} lang={lang} t={t} onOpen={setOpenDish} />
                ))}
              </div>
            ) : (
              <p className="py-16 text-center text-[15px] text-[color:var(--mn-muted)]">{t.notFound}</p>
            )
          ) : (
            <>
              {popular.length > 1 && (
                <section className="mb-8">
                  <h2 className="mn-display mb-3 flex items-center gap-2 text-[19px] font-bold">
                    <Flame size={20} className="text-[color:var(--mn-accent)]" /> {t.popularTitle}
                  </h2>
                  <div className="mn-noscroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4">
                    {popular.map((d) => (
                      <PopularCard key={d.id} dish={d} lang={lang} onOpen={setOpenDish} />
                    ))}
                  </div>
                </section>
              )}

              {sections.map(({ category, dishes: list }) => (
                <section key={category.id} id={`cat-${category.id}`} data-cat={category.id} className="mb-9">
                  <h2 className="mn-display mb-3 flex items-baseline gap-2 text-[21px] font-bold leading-tight">
                    {categoryName(category, lang)}
                    <span className="text-[13px] font-medium text-[color:var(--mn-muted-light)]">{list.length}</span>
                  </h2>
                  {list.some((d) => d.photo_url) ? (
                    <div className="grid grid-cols-2 gap-3">
                      {list.map((d, i) => (
                        <DishCard key={d.id} dish={d} lang={lang} t={t} onOpen={setOpenDish} delay={Math.min(i, 5) * 45} />
                      ))}
                    </div>
                  ) : (
                    // Категория совсем без фото (напитки, соусы) — сетка из
                    // пустых квадратов хуже простого списка.
                    <div className="mn-rise overflow-hidden rounded-[24px] bg-[var(--mn-card)]">
                      {list.map((d, i) => (
                        <DishRow key={d.id} dish={d} lang={lang} t={t} onOpen={setOpenDish} first={i === 0} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </div>

        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="mt-6 block text-center text-[11.5px] text-[color:var(--mn-muted-light)] underline decoration-dotted underline-offset-2"
        >
          ⚡ {t.poweredBy}
        </a>
      </div>

      {/* Корзина: плавающая кнопка */}
      {cart.count > 0 && !cartOpen && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4"
          style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={() => setCartOpen(true)}
            className="mn-pop mn-press pointer-events-auto mx-auto flex w-full max-w-[544px] items-center gap-3 rounded-[22px] bg-[var(--mn-accent)] px-4 py-3.5 text-[color:var(--mn-on-accent)] shadow-[0_14px_34px_-8px_var(--mn-accent)]"
          >
            <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-black/15">
              <ShoppingBag size={19} />
              <span
                key={cart.count}
                className="mn-pop absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--mn-on-accent)] px-1 text-[11px] font-black text-[color:var(--mn-accent)]"
              >
                {cart.count}
              </span>
            </span>
            <span className="flex-1 text-left text-[15px] font-bold">{t.cart}</span>
            <span className="mn-display text-[15px] font-bold">{formatPrice(cart.total, cart.items[0]?.currency ?? "UZS")}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {openDish && <DishSheet dish={openDish} lang={lang} t={t} onClose={() => setOpenDish(null)} />}

      {cartOpen && (
        <CartSheet
          venueId={venue.id}
          tableNumber={table}
          photos={photos}
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

function InfoChip({ href, external, children }: { href: string | null; external?: boolean; children: React.ReactNode }) {
  const className =
    "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[var(--mn-card)] px-3.5 py-2 text-[13px] font-medium";
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} className={`mn-press ${className}`} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Price({ dish, className = "" }: { dish: Dish; className?: string }) {
  if (dish.discount_price == null) return <span className={className}>{formatPrice(dish.price, dish.currency)}</span>;
  return (
    <span className={className}>
      <span className="text-[color:var(--mn-accent)]">{formatPrice(dish.discount_price, dish.currency)}</span>
      <span className="ml-1.5 text-[11px] font-medium text-[color:var(--mn-muted-light)] line-through">
        {new Intl.NumberFormat("ru-RU").format(dish.price)}
      </span>
    </span>
  );
}

// Одна кнопка на карточке: пока блюда нет в корзине — «цена +», после —
// счётчик на её же месте, чтобы палец не искал новые кнопки.
function AddControl({ dish, lang, t, label }: { dish: Dish; lang: Lang; t: Dict; label?: string }) {
  const cart = useCart();
  const name = dishName(dish, lang);
  const qty = cart.qtyOf(dish.id);

  if (!isOrderable(dish)) {
    return (
      <div className="rounded-full bg-[var(--mn-card-muted)] px-3 py-2.5 text-center text-[12px] font-semibold text-[color:var(--mn-muted)]">
        {t.unavailable}
      </div>
    );
  }

  if (qty === 0) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          cart.addItem({ dishId: dish.id, name, price: dish.discount_price ?? dish.price, currency: dish.currency });
        }}
        aria-label={`${name}: +1`}
        className="mn-press flex w-full items-center justify-between gap-1 rounded-full bg-[var(--mn-card-muted)] py-1.5 pl-3.5 pr-1.5 text-[13px] font-bold"
      >
        {label ? <span className="truncate">{label}</span> : <Price dish={dish} className="truncate" />}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)]">
          <Plus size={17} strokeWidth={2.6} />
        </span>
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mn-pop flex w-full items-center justify-between rounded-full bg-[var(--mn-accent)] p-1.5 text-[color:var(--mn-on-accent)]"
    >
      <button
        onClick={() => cart.setQty(dish.id, qty - 1)}
        aria-label={`${name}: −1`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15"
      >
        <Minus size={16} strokeWidth={2.6} />
      </button>
      <span className="text-[15px] font-black">{qty}</span>
      <button
        onClick={() => cart.setQty(dish.id, qty + 1)}
        aria-label={`${name}: +1`}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/15"
      >
        <Plus size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}

function DishPhoto({ dish, name, sizes }: { dish: Dish; name: string; sizes: string }) {
  if (dish.photo_url) return <Image src={dish.photo_url} alt={name} fill sizes={sizes} className="object-cover" />;
  return (
    <span
      className="mn-display flex h-full w-full items-center justify-center text-5xl font-black text-[color:var(--mn-muted-light)]"
      style={{ background: "radial-gradient(90% 90% at 20% 15%, color-mix(in srgb, var(--mn-accent) 16%, var(--mn-card-muted)), var(--mn-card-muted))" }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

function Badges({ dish, t }: { dish: Dish; t: Dict }) {
  if (!dish.is_new && !dish.is_popular) return null;
  return (
    <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
      {dish.is_popular && (
        <span className="rounded-full bg-[var(--mn-accent)] px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--mn-on-accent)]">
          {t.popular}
        </span>
      )}
      {dish.is_new && (
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-black">
          {t.new}
        </span>
      )}
    </div>
  );
}

function DishCard({
  dish,
  lang,
  t,
  onOpen,
  delay = 0,
}: {
  dish: Dish;
  lang: Lang;
  t: Dict;
  onOpen: (dish: Dish) => void;
  delay?: number;
}) {
  const name = dishName(dish, lang);
  const description = dishDescription(dish, lang);

  return (
    <article
      onClick={() => onOpen(dish)}
      className="mn-rise flex cursor-pointer flex-col overflow-hidden rounded-[24px] bg-[var(--mn-card)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`relative aspect-square w-full overflow-hidden bg-[var(--mn-card-muted)] ${isOrderable(dish) ? "" : "opacity-50 grayscale"}`}>
        <DishPhoto dish={dish} name={name} sizes="(max-width: 640px) 50vw, 280px" />
        <Badges dish={dish} t={t} />
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="line-clamp-2 text-[14px] font-semibold leading-[1.25]">{name}</p>
        {description && (
          <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-[color:var(--mn-muted)]">{description}</p>
        )}
        <div className="mt-auto pt-3">
          <AddControl dish={dish} lang={lang} t={t} />
        </div>
      </div>
    </article>
  );
}

function DishRow({
  dish,
  lang,
  t,
  onOpen,
  first,
}: {
  dish: Dish;
  lang: Lang;
  t: Dict;
  onOpen: (dish: Dish) => void;
  first: boolean;
}) {
  const name = dishName(dish, lang);
  const description = dishDescription(dish, lang);

  return (
    <article
      onClick={() => onOpen(dish)}
      className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 ${first ? "" : "border-t border-[color:var(--mn-border)]"}`}
    >
      <div className={`min-w-0 flex-1 ${isOrderable(dish) ? "" : "opacity-50"}`}>
        <p className="line-clamp-2 text-[14.5px] font-semibold leading-[1.25]">
          {name}
          {dish.is_new && (
            <span className="ml-1.5 rounded-full bg-[var(--mn-card-muted)] px-1.5 py-0.5 align-middle text-[9.5px] font-bold uppercase tracking-wide">
              {t.new}
            </span>
          )}
        </p>
        {description && (
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[color:var(--mn-muted)]">{description}</p>
        )}
      </div>
      <div className="w-[148px] shrink-0">
        <AddControl dish={dish} lang={lang} t={t} />
      </div>
    </article>
  );
}

function PopularCard({ dish, lang, onOpen }: { dish: Dish; lang: Lang; onOpen: (dish: Dish) => void }) {
  const cart = useCart();
  const name = dishName(dish, lang);
  const qty = cart.qtyOf(dish.id);

  return (
    <article
      onClick={() => onOpen(dish)}
      className="relative aspect-[4/3] w-[78%] max-w-[330px] shrink-0 cursor-pointer snap-start overflow-hidden rounded-[26px] bg-[var(--mn-card-muted)]"
    >
      <DishPhoto dish={dish} name={name} sizes="(max-width: 640px) 78vw, 330px" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3.5 text-white">
        <div className="min-w-0">
          <p className="line-clamp-2 text-[16px] font-bold leading-tight">{name}</p>
          <p className="mn-display mt-1 text-[14px] font-bold">
            {formatPrice(dish.discount_price ?? dish.price, dish.currency)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            cart.addItem({ dishId: dish.id, name, price: dish.discount_price ?? dish.price, currency: dish.currency });
          }}
          aria-label={`${name}: +1`}
          className="mn-press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)] shadow-lg"
        >
          <Plus size={22} strokeWidth={2.6} />
          {qty > 0 && (
            <span key={qty} className="mn-pop absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-black text-black">
              {qty}
            </span>
          )}
        </button>
      </div>
    </article>
  );
}

// Карточка блюда целиком: крупное фото и полное описание, которое в сетке
// обрезано до двух строк.
function DishSheet({ dish, lang, t, onClose }: { dish: Dish; lang: Lang; t: Dict; onClose: () => void }) {
  const name = dishName(dish, lang);
  const description = dishDescription(dish, lang);

  return (
    <div className="mn-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div
        className="mn-sheet flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] bg-[var(--mn-bg)] text-[color:var(--mn-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative aspect-[4/3] w-full bg-[var(--mn-card-muted)]">
            <DishPhoto dish={dish} name={name} sizes="(max-width: 640px) 100vw, 576px" />
            <Badges dish={dish} t={t} />
            <button
              onClick={onClose}
              aria-label="Закрыть"
              className="mn-press absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md"
            >
              <X size={19} />
            </button>
          </div>
          <div className="px-4 pb-2 pt-4">
            <h3 className="mn-display text-[22px] font-bold leading-tight">{name}</h3>
            {description && (
              <p className="mt-2 whitespace-pre-line text-[14.5px] leading-relaxed text-[color:var(--mn-muted)]">
                {description}
              </p>
            )}
          </div>
        </div>
        <div
          className="flex shrink-0 items-center gap-3 border-t border-[color:var(--mn-border)] px-4 pt-3"
          style={{ paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))" }}
        >
          <Price dish={dish} className="mn-display shrink-0 text-[18px] font-bold" />
          <div className="ml-auto w-[52%]">
            <AddControl dish={dish} lang={lang} t={t} label={t.add} />
          </div>
        </div>
      </div>
    </div>
  );
}
