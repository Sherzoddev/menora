"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrder } from "@/lib/orders-actions";
import { useCart } from "@/lib/cart-context";
import type { MenuTheme } from "@/lib/menu-theme";
import { LIGHT_THEME } from "@/lib/menu-theme";
import type { VenueLocation } from "@/lib/geo";
import { distanceKm } from "@/lib/geo";
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
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  // Известны только если гость сам нажал "Определить местоположение" — при
  // ручном вводе адреса текстом координат нет, и проверить радиус нечем.
  const [customerCoords, setCustomerCoords] = useState<{ lat: number; lng: number } | null>(null);
  // Ссылка на точку на карте — отдельно от текста адреса (раньше координаты
  // пихались прямо в поле адреса вместо человекочитаемого текста).
  const [mapLink, setMapLink] = useState<{ provider: "google" | "yandex"; url: string } | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const isDineIn = !!tableNumber;
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

  // Общий путь для всех трёх способов получить координаты (GPS-кнопки и
  // подтверждение на карте): сохраняет координаты, тянет читаемый адрес
  // через обратное геокодирование и строит ссылку на точку.
  async function applyCoords(lat: number, lng: number, provider: "google" | "yandex") {
    setCustomerCoords({ lat, lng });
    const latStr = lat.toFixed(6);
    const lngStr = lng.toFixed(6);
    // Яндекс.Карты принимают координаты в порядке долгота,широта — в
    // обратном порядке относительно Google Maps.
    const link =
      provider === "yandex"
        ? `https://yandex.ru/maps/?pt=${lngStr},${latStr}&z=17&l=map`
        : `https://maps.google.com/?q=${latStr},${lngStr}`;
    setMapLink({ provider, url: link });
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${latStr}&lng=${lngStr}`);
      const data = await res.json();
      setAddress(data.address || `Координаты: ${latStr}, ${lngStr}`);
    } catch {
      setAddress(`Координаты: ${latStr}, ${lngStr}`);
    }
  }

  function locateMe(provider: "google" | "yandex") {
    if (!navigator.geolocation) {
      setLocationError("Геолокация не поддерживается этим браузером");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyCoords(pos.coords.latitude, pos.coords.longitude, provider);
        setLocating(false);
      },
      () => {
        setLocationError("Не удалось определить местоположение — введите адрес вручную");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function openMapPicker() {
    setLocationError(null);
    setShowMapPicker(true);
  }

  return (
    <form action={formAction} className="space-y-3">
      <Field label="Ваше имя" theme={theme}>
        <input name="customer_name" required className="checkout-input" placeholder="Иван" />
      </Field>
      <Field label="Телефон" theme={theme}>
        <input name="phone" required className="checkout-input" placeholder="+998 90 123 45 67" />
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
                  // Адрес поменяли руками после определения местоположения —
                  // координаты больше не гарантированно соответствуют ему.
                  setCustomerCoords(null);
                  setMapLink(null);
                }}
                className="checkout-input"
                placeholder="Улица, дом, квартира"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  type="button"
                  onClick={() => locateMe("google")}
                  disabled={locating}
                  className="flex-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: accent, color: accent }}
                >
                  📍 Google Карты
                </button>
                <button
                  type="button"
                  onClick={() => locateMe("yandex")}
                  disabled={locating}
                  className="flex-1 rounded-xl border px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
                  style={{ borderColor: accent, color: accent }}
                >
                  📍 Яндекс Карты
                </button>
              </div>
              <button
                type="button"
                onClick={openMapPicker}
                className="mt-1.5 w-full rounded-xl border px-2.5 py-1.5 text-xs font-medium"
                style={{ borderColor: accent, color: accent, background: `${accent}0d` }}
              >
                🗺️ Указать точно на карте
              </button>
              {locating && <p className="mt-1 text-xs" style={{ color: theme.muted }}>Определяем адрес...</p>}
              {mapLink && (
                <a
                  href={mapLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs underline"
                  style={{ color: accent }}
                >
                  📍 Открыть точку на {mapLink.provider === "yandex" ? "Яндекс Картах" : "Google Картах"}
                </a>
              )}
              {locationError && <p className="mt-1 text-xs text-red-500">{locationError}</p>}
              {needsLocation && !outOfRadius && (
                <p className="mt-1 text-xs font-medium" style={{ color: accent }}>
                  У заведения ограничена зона доставки — укажите точное местоположение кнопкой выше, чтобы оформить заказ.
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
        <input name="promo_code" className="checkout-input" placeholder="Например, WELCOME10" />
      </Field>

      <label className="flex items-center gap-2 text-xs" style={{ color: theme.muted }}>
        <input type="checkbox" name="use_points" />
        Списать бонусные баллы (если есть на этот номер телефона)
      </label>

      <Field label="Комментарий (необязательно)" theme={theme}>
        <textarea name="comment" rows={2} className="checkout-input" />
      </Field>

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
            await applyCoords(coords.lat, coords.lng, "yandex");
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
