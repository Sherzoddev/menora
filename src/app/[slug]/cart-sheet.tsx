"use client";

import { useState } from "react";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/menu-utils";
import type { MenuTheme } from "@/lib/menu-theme";
import { LIGHT_THEME } from "@/lib/menu-theme";
import CheckoutForm from "./checkout-form";

export default function CartSheet({
  venueId,
  accent,
  tableNumber,
  theme = LIGHT_THEME,
  onClose,
}: {
  venueId: string;
  accent: string;
  tableNumber?: string;
  theme?: MenuTheme;
  onClose: () => void;
}) {
  const cart = useCart();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [orderId, setOrderId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
        style={{ background: theme.bg, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {step === "cart" && "Корзина"}
            {step === "checkout" && "Оформление заказа"}
            {step === "success" && "Готово"}
          </h2>
          <button onClick={onClose} style={{ color: theme.muted }}>
            <X size={20} />
          </button>
        </div>

        {step === "cart" && (
          <>
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center" style={{ color: theme.muted }}>
                <ShoppingBag size={28} />
                <p className="text-sm">Корзина пуста</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.items.map((item) => (
                    <div
                      key={item.dishId}
                      className="flex items-center justify-between gap-3 rounded-2xl p-3 shadow-sm"
                      style={{ background: theme.card }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs" style={{ color: theme.muted }}>{formatPrice(item.price, item.currency)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => cart.setQty(item.dishId, item.qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border"
                          style={{ borderColor: theme.border, color: theme.text }}
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-4 text-center text-sm font-medium">{item.qty}</span>
                        <button
                          onClick={() => cart.setQty(item.dishId, item.qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-white"
                          style={{ background: accent }}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between text-sm font-medium">
                  <span>Итого</span>
                  <span>{formatPrice(cart.total, cart.items[0]?.currency ?? "UZS")}</span>
                </div>

                <button
                  onClick={() => setStep("checkout")}
                  className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white"
                  style={{ background: accent }}
                >
                  Оформить заказ
                </button>
              </>
            )}
          </>
        )}

        {step === "checkout" && (
          <CheckoutForm
            venueId={venueId}
            accent={accent}
            tableNumber={tableNumber}
            theme={theme}
            onSuccess={(id) => {
              setOrderId(id);
              setStep("success");
            }}
          />
        )}

        {step === "success" && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
              style={{ background: accent }}
            >
              ✓
            </div>
            <p className="font-medium">Спасибо! Мы получили ваш заказ</p>
            <p className="text-sm" style={{ color: theme.muted }}>Заведение свяжется с вами для подтверждения</p>
            {orderId && (
              <a
                href={`/order/${orderId}`}
                className="mt-1 text-sm font-semibold underline underline-offset-2"
                style={{ color: accent }}
              >
                Отследить статус заказа
              </a>
            )}
            <button
              onClick={onClose}
              className="mt-2 rounded-xl border px-5 py-2 text-sm font-medium"
              style={{ borderColor: theme.border, color: theme.text }}
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
