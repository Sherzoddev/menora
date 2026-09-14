"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { createOrder, previewOrderTotals } from "@/lib/orders-actions";
import { useCart } from "@/lib/cart-context";
import type { MenuTheme } from "@/lib/menu-theme";
import { LIGHT_THEME } from "@/lib/menu-theme";
import type { VenueLocation } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";
import { formatPrice } from "@/lib/menu-utils";
import AddressMapPicker from "./address-map-picker";

// Ташкент — точка по умолчанию для карты, если у гостя нет GPS и заведение
// ещё не указало координаты (просто стартовый вид, не влияет на расчёт).
const DEFAULT_MAP_CENTER = { lat: 41.311081, lng: 69.240562 };

export default function CheckoutForm({
  venueId,
  accent,
  tableNumber,
  theme = LIGHT_THEME,
  venueLocation = null,
  onSuccess,
}: {
  venueId: string;
  accent: string;
  tableNumber?: string;
  theme?: MenuTheme;
  venueLocation?: VenueLocation | null;
  onSuccess: (orderId: string) => void;
}) {
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [address, setAddress] = useState("");
  // Известны только после того, как гость подтвердил точку на карте — при
  // ручном вводе адреса текстом координат нет, и проверить радиус нечем.
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Ссылки на выбранную точку — показываем оба варианта карт сразу, раз
  // теперь это единственный способ указать место (было по кнопке на каждую
  // карту отдельно с автогеолокацией, но она давала неточный/неверный адрес).
  const [mapLinks, setMapLinks] = useState<{ google: string; yandex: string } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [phone, setPhone] = useState("");
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

  const distanceFromVenue = useMemo(() => {
    if (!customerCoords || !venueLocation) return null;
    return distanceKm(venueLocation.lat, venueLocation.lng, customerCoords.lat, customerCoords.lng);
  }, [customerCoords, venueLocation]);

  const outOfRadius =
    fulfillment === "delivery" &&
    distanceFromVenue != null &&
    venueLocation?.radiusKm != null &&
    distanceFromVenue > venueLocation.radiusKm;

  // Заведение ограничило доставку радиусом — раньше проверка срабатывала
  // только если гость сам нажал кнопку геолокации, а при обычном вводе
  // адреса текстом координат не было и радиус молча не проверялся вообще.
  // Теперь, если радиус включён, точное местоположение обязательно.
  const radiusEnforced = fulfillment === "delivery" && venueLocation?.radiusKm != null;
  const needsLocation = radiusEnforced && !customerCoords;

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
      if (customerCoords) {
        formData.set("customer_lat", String(customerCoords.lat));
        formData.set("customer_lng", String(customerCoords.lng));
      }
      const result = await action(prevState, formData);
      if (result.ok && result.orderId) {
        cart.clear();
        onSuccess(result.orderId);
      }
      return result;
    },
    { error: null },
  );

  // Единственный источник координат теперь — точка, выбранная на карте.
  // Превращаем координаты в читаемый адрес через обратное геокодирование;
  // голые координаты в поле остаются только если сервис не ответил.
  async function applyCoords(lat: number, lng: number) {
    setCustomerCoords({ lat, lng });
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    setGeocoding(true);
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${latStr}&lng=${lngStr}`);
      const data = await res.json();
      setAddress(data.address || `${latStr}, ${lngStr}`);
    } catch {
      setAddress(`${latStr}, ${lngStr}`);
    } finally {
      setGeocoding(false);
    }
    setMapLinks({
      google: `https://maps.google.com/?q=${latStr},${lngStr}`,
      // Яндекс.Карты принимают координаты в порядке долгота,широта — в
      // обратном порядке относительно Google Maps.
      yandex: `https://yandex.ru/maps/?pt=${lngStr},${latStr}&z=17&l=map`,
    });
  }

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Ваше имя" theme={theme}>
        <input name="customer_name" required className="checkout-input" placeholder="Шерзод" />
      </Field>
      <Field label="Телефон" theme={theme}>
        <input
          name="phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="checkout-input"
          placeholder="+998 90 123 45 67"
        />
      </Field>

      {isDineIn ? (
        <>
          <div className="rounded-xl border px-3.5 py-2.5 text-sm font-medium" style={{ borderColor: accent, color: accent, background: `${accent}14` }}>
            Заказ за столом №{tableNumber}
          </div>
          <input type="hidden" name="fulfillment" value="dine_in" />
          <input type="hidden" name="table_number" value={tableNumber} />
        </>
      ) : (
        <>
          <Field label="Способ получения" theme={theme}>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFulfillment("delivery")}
                className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
                style={
                  fulfillment === "delivery"
                    ? { borderColor: accent, color: accent, background: `${accent}14` }
                    : { borderColor: theme.border, color: theme.muted }
                }
              >
                Доставка
              </button>
              <button
                type="button"
                onClick={() => setFulfillment("pickup")}
                className="flex-1 rounded-xl border px-3 py-2 text-sm font-medium"
                style={
                  fulfillment === "pickup"
                    ? { borderColor: accent, color: accent, background: `${accent}14` }
                    : { borderColor: theme.border, color: theme.muted }
                }
              >
                Самовывоз
              </button>
            </div>
            <input type="hidden" name="fulfillment" value={fulfillment} />
          </Field>

          {fulfillment === "delivery" && (
            <Field label="Адрес доставки" theme={theme}>
              <input
                name="address"
                required
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  // Адрес поменяли руками после выбора точки на карте —
                  // координаты больше не гарантированно соответствуют ему.
                  setCustomerCoords(null);
                  setMapLinks(null);
                }}
                className="checkout-input"
                placeholder="Нажмите «Указать на карте» ниже"
              />
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                className="mt-1.5 w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium"
                style={{ borderColor: accent, color: accent, background: `${accent}0d` }}
              >
                🗺️ Указать точно на карте
              </button>
              {geocoding && <p className="mt-1 text-xs" style={{ color: theme.muted }}>Определяем адрес...</p>}
              {mapLinks && (
                <div className="mt-1 flex gap-3">
                  <a href={mapLinks.google} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: accent }}>
                    📍 Открыть в Google Картах
                  </a>
                  <a href={mapLinks.yandex} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: accent }}>
                    📍 Открыть в Яндекс Картах
                  </a>
                </div>
              )}
              {needsLocation && !outOfRadius && (
                <p className="mt-1 text-xs font-medium" style={{ color: accent }}>
                  У заведения ограничена зона доставки — укажите точку на карте выше, чтобы оформить заказ.
                </p>
              )}
              {outOfRadius && distanceFromVenue != null && venueLocation?.radiusKm != null && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  Вы примерно в {Math.round(distanceFromVenue)} км от заведения — доставка работает в радиусе{" "}
                  {venueLocation.radiusKm} км. Свяжитесь с заведением напрямую или выберите самовывоз.
                </p>
              )}
            </Field>
          )}
        </>
      )}

      <Field label="Промокод (необязательно)" theme={theme}>
        <input
          name="promo_code"
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          className="checkout-input"
          placeholder="Например, WELCOME10"
        />
        {totals?.promoError && promoCode.trim() && (
          <p className="mt-1 text-xs text-red-500">{totals.promoError}</p>
        )}
      </Field>

      <label className="flex items-center gap-2 text-xs" style={{ color: theme.muted }}>
        <input type="checkbox" name="use_points" checked={usePoints} onChange={(e) => setUsePoints(e.target.checked)} />
        Списать бонусные баллы
        {totals && totals.pointsAvailable > 0 ? ` (доступно: ${totals.pointsAvailable})` : " (если есть на этот номер телефона)"}
      </label>

      <Field label="Комментарий (необязательно)" theme={theme}>
        <textarea name="comment" rows={2} className="checkout-input" />
      </Field>

      <div className="rounded-xl border px-3.5 py-3 text-sm" style={{ borderColor: theme.border }}>
        <div className="flex items-center justify-between" style={{ color: theme.muted }}>
          <span>Товары</span>
          <span>{formatPrice(cart.total, currency)}</span>
        </div>
        {!!totals?.promoDiscount && (
          <div className="mt-1 flex items-center justify-between text-red-500">
            <span>Промокод</span>
            <span>−{formatPrice(totals.promoDiscount, currency)}</span>
          </div>
        )}
        {!!totals?.pointsDiscount && (
          <div className="mt-1 flex items-center justify-between text-red-500">
            <span>Баллы</span>
            <span>−{formatPrice(totals.pointsDiscount, currency)}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-2 text-base font-semibold" style={{ borderColor: theme.border, color: theme.text }}>
          <span>Итого</span>
          {totals && (totals.promoDiscount > 0 || totals.pointsDiscount > 0) ? (
            <span className="flex items-baseline gap-1.5">
              <span className="text-xs font-normal line-through" style={{ color: theme.mutedLight }}>
                {formatPrice(cart.total, currency)}
              </span>
              <span>{formatPrice(totals.total, currency)}</span>
            </span>
          ) : (
            <span>{formatPrice(cart.total, currency)}</span>
          )}
        </div>
      </div>

      {state.error && <p className="text-sm text-red-500">{state.error}</p>}

      <button
        type="submit"
        disabled={pending || outOfRadius || needsLocation}
        className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: accent }}
      >
        {pending ? "Отправляем..." : "Оформить заказ"}
      </button>

      {showMapPicker && (
        <AddressMapPicker
          initial={customerCoords ?? venueLocation ?? DEFAULT_MAP_CENTER}
          theme={theme}
          accent={accent}
          onCancel={() => setShowMapPicker(false)}
          onConfirm={async (coords) => {
            setShowMapPicker(false);
            await applyCoords(coords.lat, coords.lng);
          }}
        />
      )}

      <style jsx>{`
        .checkout-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid ${theme.border};
          background: ${theme.inputBg};
          padding: 0.6rem 0.9rem;
          font-size: 0.875rem;
          color: ${theme.text};
          outline: none;
        }
        .checkout-input::placeholder {
          color: ${theme.mutedLight};
        }
        .checkout-input:focus {
          border-color: ${accent};
        }
      `}</style>
    </form>
  );
}

function Field({ label, theme, children }: { label: string; theme: MenuTheme; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium" style={{ color: theme.muted }}>{label}</label>
      {children}
    </div>
  );
}
