"use client";

import { useState } from "react";
import { X, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/menu-utils";
import CheckoutForm from "./checkout-form";

export default function CartSheet({
  venueId,
  accent,
  tableNumber,
  onClose,
}: {
  venueId: string;
  accent: string;
  tableNumber?: string;
  onClose: () => void;
}) {
  const cart = useCart();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [orderId, setOrderId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-[#FBF3E6] p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#3a2f22]">
            {step === "cart" && "Корзина"}
            {step === "checkout" && "Оформление заказа"}
            {step === "success" && "Готово"}
          </h2>
          <button onClick={onClose} className="text-[#8a7a63] hover:text-[#3a2f22]">
            <X size={20} />
          </button>
        </div>

        {step === "cart" && (
          <>
            {cart.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-[#8a7a63]">
                <ShoppingBag size={28} />
                <p className="text-sm">Корзина пуста</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {cart.items.map((item) => (
                    <div key={item.dishId} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#3a2f22]">{item.name}</p>
                        <p className="text-xs text-[#8a7a63]">{formatPrice(item.price, item.currency)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => cart.setQty(item.dishId, item.qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[#e7ddcd] text-[#3a2f22]"
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

                <div className="mt-5 flex items-center justify-between text-sm font-medium text-[#3a2f22]">
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
            <p className="font-medium text-[#3a2f22]">Спасибо! Мы получили ваш заказ</p>
            <p className="text-sm text-[#8a7a63]">Заведение свяжется с вами для подтверждения</p>
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
              className="mt-2 rounded-xl border border-[#e7ddcd] px-5 py-2 text-sm font-medium text-[#3a2f22]"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
