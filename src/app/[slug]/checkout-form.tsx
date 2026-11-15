"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Bike, MapPin, Navigation, PencilLine, Store } from "lucide-react";
import { createOrder, previewOrderTotals } from "@/lib/orders-actions";
import { useCart } from "@/lib/cart-context";
import type { VenueLocation } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";
import { formatPrice } from "@/lib/menu-utils";
import AddressMapPicker from "./address-map-picker";

// Ташкент — точка по умолчанию для карты, если у гостя нет GPS и заведение
// ещё не указало координаты (просто стартовый вид, не влияет на расчёт).
const DEFAULT_MAP_CENTER = { lat: 41.311081, lng: 69.240562 };

// Имя, телефон и последняя точка доставки запоминаются на устройстве —
// постоянный гость оформляет повторный заказ в два тапа.
const GUEST_KEY = "menora-guest";
type SavedGuest = {
  name?: string;
  phone?: string;
  address?: string;
  details?: string;
  coords?: { lat: number; lng: number };
};

function loadGuest(): SavedGuest {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? "{}") as SavedGuest;
  } catch {
    return {};
  }
}

export default function CheckoutForm({
  venueId,
  tableNumber,
  venueLocation = null,
  onSuccess,
}: {
  venueId: string;
  tableNumber?: string;
  venueLocation?: VenueLocation | null;
  onSuccess: (orderId: string) => void;
}) {
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [details, setDetails] = useState("");
  // Точка, которую гость подтвердил на карте. Именно она (а не текст адреса)
  // уходит курьеру как маршрут и геометка, поэтому для доставки обязательна.
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [fromLastOrder, setFromLastOrder] = useState(false);
  // Текст адреса подставляем из геокодера, только пока гость не начал
  // править его сам — его «ул. Навои, 12» важнее угаданного «Джума».
  const addressEdited = useRef(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [usePoints, setUsePoints] = useState(false);
  const [totals, setTotals] = useState<{
    promoDiscount: number;
    promoError: string | null;
    pointsAvailable: number;
    pointsDiscount: number;
    total: number;
  } | null>(null);
  const isDineIn = !!tableNumber;
  const currency = cart.items[0]?.currency ?? "UZS";
  // One id per checkout attempt (this form remounts fresh each time the cart
  // sheet opens) — a retry/double-tap within the same attempt reuses it, so
  // the server can de-dupe instead of creating a second order.
  const [clientRequestId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    const saved = loadGuest();
    const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
    setName(saved.name || [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(" "));
    if (saved.phone) setPhone(saved.phone);
    if (saved.coords) {
      setCustomerCoords(saved.coords);
      setAddress(saved.address ?? "");
      setDetails(saved.details ?? "");
      setFromLastOrder(true);
      addressEdited.current = !!saved.address;
    }
  }, []);

  const distanceFromVenue = useMemo(() => {
    if (!customerCoords || !venueLocation) return null;
    return distanceKm(venueLocation.lat, venueLocation.lng, customerCoords.lat, customerCoords.lng);
  }, [customerCoords, venueLocation]);

  const outOfRadius =
    fulfillment === "delivery" &&
    !isDineIn &&
    distanceFromVenue != null &&
    venueLocation?.radiusKm != null &&
    distanceFromVenue > venueLocation.radiusKm;

  const needsLocation = fulfillment === "delivery" && !isDineIn && !customerCoords;

  // Живой предпросмотр итоговой суммы (как в Яндексе) — раньше на чекауте
  // вообще не было видно ни суммы товаров, ни того, что изменилось после
  // промокода/баллов, только в самой корзине до открытия формы.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewOrderTotals(venueId, { subtotal: cart.total, promoCode, phone, usePoints });
      if (!cancelled) setTotals(result);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [venueId, cart.total, promoCode, phone, usePoints]);

  const action = createOrder.bind(null, venueId);
  const [state, formAction, pending] = useActionState<
    { error: string | null; ok?: boolean; orderId?: string },
    FormData
  >(
    async (prevState, formData) => {
      formData.set(
        "items",
        JSON.stringify(cart.items.map((i) => ({ dishId: i.dishId, name: i.name, price: i.price, qty: i.qty }))),
      );
      formData.set("client_request_id", clientRequestId);
      formData.set("tg_init_data", window.Telegram?.WebApp?.initData ?? "");
      if (customerCoords && fulfillment === "delivery" && !isDineIn) {
        formData.set("customer_lat", String(customerCoords.lat));
        formData.set("customer_lng", String(customerCoords.lng));
      }
      const result = await action(prevState, formData);
      if (result.ok && result.orderId) {
        try {
          const guest: SavedGuest = { ...loadGuest(), name: name.trim(), phone: phone.trim() };
          if (customerCoords && fulfillment === "delivery" && !isDineIn) {
            guest.coords = customerCoords;
            guest.address = address.trim();
            guest.details = details.trim();
          }
          localStorage.setItem(GUEST_KEY, JSON.stringify(guest));
        } catch {
          // ignore
        }
        cart.clear();
        onSuccess(result.orderId);
      }
      return result;
    },
    { error: null },
  );

  // Координаты — из точки на карте. Подпись к ним — из обратного
  // геокодирования; если оно ничего не нашло, поле остаётся пустым для
  // ручного ввода (сама точка всё равно уходит курьеру).
  async function applyCoords(lat: number, lng: number) {
    // Метку унесли в другое место — старый текст адреса и подъезд/квартира к
    // ней уже не относятся. Небольшая поправка метки их не трогает.
    const movedFar = customerCoords != null && distanceKm(customerCoords.lat, customerCoords.lng, lat, lng) > 0.15;
    if (movedFar) {
      addressEdited.current = false;
      setDetails("");
    }
    setCustomerCoords({ lat, lng });
    setFromLastOrder(false);
    if (addressEdited.current && address.trim()) return;
    setGeocoding(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat.toFixed(6)}&lng=${lng.toFixed(6)}`);
      const data = await res.json();
      if (!addressEdited.current || !address.trim()) setAddress(data.address || "");
    } catch {
      // ignore — без подписи, но с точкой
    } finally {
      setGeocoding(false);
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        // Без точки на карте заказ на доставку не отправляем — вместо мёртвой
        // кнопки сразу открываем карту.
        if (needsLocation) {
          e.preventDefault();
          setShowMapPicker(true);
        }
      }}
      className="space-y-5"
    >
      {isDineIn ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--mn-accent)_10%,transparent)] px-4 py-3.5">
            <Store size={20} className="text-[color:var(--mn-accent)]" />
            <span className="text-[15px] font-semibold">Заказ за столом №{tableNumber}</span>
          </div>
          <input type="hidden" name="fulfillment" value="dine_in" />
          <input type="hidden" name="table_number" value={tableNumber} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 rounded-[20px] bg-[var(--mn-card-muted)] p-1.5">
            {(
              [
                { key: "delivery", label: "Доставка", icon: Bike },
                { key: "pickup", label: "Самовывоз", icon: Store },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFulfillment(key)}
                aria-pressed={fulfillment === key}
                className={`flex items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-semibold transition ${
                  fulfillment === key
                    ? "bg-[var(--mn-card)] text-[color:var(--mn-text)] shadow-sm"
                    : "text-[color:var(--mn-muted)]"
                }`}
              >
                <Icon size={17} /> {label}
              </button>
            ))}
          </div>
          <input type="hidden" name="fulfillment" value={fulfillment} />

          {fulfillment === "delivery" && (
            <Section title="Куда привезти">
              {customerCoords ? (
                <div className="overflow-hidden rounded-[20px] border-[1.5px] border-[color:var(--mn-border)] bg-[var(--mn-card)]">
                  <button
                    type="button"
                    onClick={() => setShowMapPicker(true)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)]">
                      <MapPin size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold">
                        {fromLastOrder ? "Точка с прошлого заказа" : "Точка на карте выбрана"}
                      </span>
                      <span className="block truncate text-[12.5px] text-[color:var(--mn-muted)]">
                        {geocoding
                          ? "Определяем адрес…"
                          : distanceFromVenue != null
                            ? `${distanceFromVenue < 1 ? `${Math.round(distanceFromVenue * 1000)} м` : `${distanceFromVenue.toFixed(1)} км`} от заведения`
                            : "Курьер получит маршрут к этой точке"}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--mn-card-muted)] px-3 py-1.5 text-[12px] font-semibold">
                      <PencilLine size={13} /> Изменить
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowMapPicker(true)}
                  className="mn-press flex w-full items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-[color:var(--mn-accent)] bg-[color-mix(in_srgb,var(--mn-accent)_7%,transparent)] px-3.5 py-4 text-left"
                >
                  <span className="mn-pulse flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)]">
                    <Navigation size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-bold">Указать точку на карте</span>
                    <span className="block text-[12.5px] leading-snug text-[color:var(--mn-muted)]">
                      Курьер приедет ровно туда, куда вы поставите метку
                    </span>
                  </span>
                </button>
              )}

              {outOfRadius && distanceFromVenue != null && venueLocation?.radiusKm != null && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-500">
                  До вас {distanceFromVenue.toFixed(1)} км, а доставка работает в радиусе {venueLocation.radiusKm} км.
                  Выберите самовывоз или свяжитесь с заведением.
                </p>
              )}

              <input
                name="address"
                value={address}
                onChange={(e) => {
                  addressEdited.current = true;
                  setAddress(e.target.value);
                }}
                className="mn-field"
                placeholder="Улица и дом"
                autoComplete="street-address"
              />
              <input
                name="address_details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="mn-field"
                placeholder="Ориентир, подъезд, этаж, квартира"
              />
            </Section>
          )}
        </>
      )}

      <Section title="Контакты">
        <input
          name="customer_name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mn-field"
          placeholder="Ваше имя"
          autoComplete="name"
        />
        <input
          name="phone"
          required
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mn-field"
          placeholder="+998 90 123 45 67"
          autoComplete="tel"
        />
      </Section>

      <Section title="Скидка и пожелания">
        <input
          name="promo_code"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          className="mn-field uppercase placeholder:normal-case"
          placeholder="Промокод"
          autoCapitalize="characters"
        />
        {totals?.promoError && promoCode.trim() && <p className="text-[12.5px] text-red-500">{totals.promoError}</p>}

        {(totals?.pointsAvailable ?? 0) > 0 && (
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl bg-[var(--mn-card)] px-4 py-3.5">
            <span className="text-[14px] font-medium">
              Списать баллы
              <span className="ml-1.5 text-[color:var(--mn-muted)]">доступно {totals?.pointsAvailable}</span>
            </span>
            <input
              type="checkbox"
              name="use_points"
              checked={usePoints}
              onChange={(e) => setUsePoints(e.target.checked)}
              className="h-5 w-5 accent-[var(--mn-accent)]"
            />
          </label>
        )}

        <textarea name="comment" rows={2} className="mn-field resize-none" placeholder="Комментарий к заказу" />
      </Section>

      <div className="rounded-[20px] bg-[var(--mn-card)] px-4 py-3.5 text-[14px]">
        <div className="flex items-center justify-between text-[color:var(--mn-muted)]">
          <span>Товары</span>
          <span>{formatPrice(cart.total, currency)}</span>
        </div>
        {!!totals?.promoDiscount && (
          <div className="mt-1.5 flex items-center justify-between text-emerald-500">
            <span>Промокод</span>
            <span>−{formatPrice(totals.promoDiscount, currency)}</span>
          </div>
        )}
        {!!totals?.pointsDiscount && (
          <div className="mt-1.5 flex items-center justify-between text-emerald-500">
            <span>Баллы</span>
            <span>−{formatPrice(totals.pointsDiscount, currency)}</span>
          </div>
        )}
        <div className="mt-2.5 flex items-baseline justify-between border-t border-[color:var(--mn-border)] pt-2.5">
          <span className="text-[15px] font-semibold">Итого</span>
          <span className="mn-display text-[19px] font-bold">
            {formatPrice(totals && (totals.promoDiscount > 0 || totals.pointsDiscount > 0) ? totals.total : cart.total, currency)}
          </span>
        </div>
      </div>

      {state.error && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-500">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || outOfRadius}
        className="mn-press w-full rounded-2xl bg-[var(--mn-accent)] px-4 py-4 text-[15px] font-bold text-[color:var(--mn-on-accent)] disabled:opacity-50"
      >
        {pending ? "Отправляем…" : needsLocation ? "Указать адрес на карте" : "Оформить заказ"}
      </button>

      {showMapPicker && (
        <AddressMapPicker
          initial={customerCoords ?? venueLocation ?? DEFAULT_MAP_CENTER}
          autoLocate={!customerCoords}
          venueLocation={venueLocation}
          onCancel={() => setShowMapPicker(false)}
          onConfirm={async (coords) => {
            setShowMapPicker(false);
            await applyCoords(coords.lat, coords.lng);
          }}
        />
      )}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[color:var(--mn-muted)]">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
