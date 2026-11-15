"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Check, ChevronLeft, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/menu-utils";
import type { VenueLocation } from "@/lib/geo";
import CheckoutForm from "./checkout-form";

// Цвета — из CSS-переменных --mn-* корневого элемента меню (menu-view.tsx),
// шторка рендерится внутри него.
export default function CartSheet({
  venueId,
  tableNumber,
  venueLocation = null,
  photos,
  onClose,
}: {
  venueId: string;
  tableNumber?: string;
  venueLocation?: VenueLocation | null;
  // dishId -> фото: в самой корзине (и в общей корзине стола) фото не хранятся.
  photos: Map<string, string | null>;
  onClose: () => void;
}) {
  const cart = useCart();
  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");
  const [orderId, setOrderId] = useState<string | null>(null);
  const currency = cart.items[0]?.currency ?? "UZS";

  return (
    <div className="mn-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55" onClick={onClose}>
      <div
        className="mn-sheet flex max-h-[94dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-[var(--mn-bg)] text-[color:var(--mn-text)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-[var(--mn-border)]" />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3 pt-3">
          {step === "checkout" && (
            <button
              onClick={() => setStep("cart")}
              aria-label="Назад в корзину"
              className="mn-press -ml-1 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mn-card)]"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="mn-display flex-1 text-[20px] font-bold">
            {step === "cart" && "Корзина"}
            {step === "checkout" && "Оформление"}
            {step === "success" && "Заказ принят"}
          </h2>
          {step === "cart" && cart.items.length > 0 && (
            <button
              onClick={cart.clear}
              aria-label="Очистить корзину"
              className="mn-press flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mn-card)] text-[color:var(--mn-muted)]"
            >
              <Trash2 size={17} />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="mn-press flex h-10 w-10 items-center justify-center rounded-full bg-[var(--mn-card)]"
          >
            <X size={19} />
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4"
          style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}
        >
          {step === "cart" &&
            (cart.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center text-[color:var(--mn-muted)]">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--mn-card)]">
                  <ShoppingBag size={26} />
                </span>
                <p className="text-[15px] font-medium">В корзине пока пусто</p>
              </div>
            ) : (
              <>
                <div className="overflow-hidden rounded-[22px] bg-[var(--mn-card)]">
                  {cart.items.map((item, i) => {
                    const photo = photos.get(item.dishId);
                    return (
                      <div
                        key={item.dishId}
                        className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-[color:var(--mn-border)]" : ""}`}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--mn-card-muted)]">
                          {photo ? (
                            <Image src={photo} alt="" fill sizes="56px" className="object-cover" />
                          ) : (
                            <span className="mn-display flex h-full w-full items-center justify-center text-lg font-bold text-[color:var(--mn-muted-light)]">
                              {item.name.slice(0, 1)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[14px] font-semibold leading-snug">{item.name}</p>
                          <p className="mt-0.5 text-[13px] text-[color:var(--mn-muted)]">
                            {formatPrice(item.price * item.qty, item.currency)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--mn-card-muted)] p-1">
                          <button
                            onClick={() => cart.setQty(item.dishId, item.qty - 1)}
                            aria-label={`${item.name}: −1`}
                            className="flex h-8 w-8 items-center justify-center rounded-full"
                          >
                            <Minus size={15} />
                          </button>
                          <span className="w-5 text-center text-[14px] font-bold">{item.qty}</span>
                          <button
                            onClick={() => cart.setQty(item.dishId, item.qty + 1)}
                            aria-label={`${item.name}: +1`}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--mn-card)] shadow-sm"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => setStep("checkout")}
                  className="mn-press mt-4 flex w-full items-center justify-between rounded-2xl bg-[var(--mn-accent)] px-5 py-4 text-[15px] font-bold text-[color:var(--mn-on-accent)]"
                >
                  <span>Оформить заказ</span>
                  <span className="flex items-center gap-2">
                    {formatPrice(cart.total, currency)} <ArrowRight size={18} />
                  </span>
                </button>
              </>
            ))}

          {step === "checkout" && (
            <CheckoutForm
              venueId={venueId}
              tableNumber={tableNumber}
              venueLocation={venueLocation}
              onSuccess={(id) => {
                setOrderId(id);
                setStep("success");
              }}
            />
          )}

          {step === "success" && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="mn-pop flex h-20 w-20 items-center justify-center rounded-full bg-[var(--mn-accent)] text-[color:var(--mn-on-accent)]">
                <Check size={38} strokeWidth={3} />
              </div>
              <p className="mn-display mt-2 text-[19px] font-bold">Спасибо за заказ!</p>
              <p className="max-w-[260px] text-[14px] leading-snug text-[color:var(--mn-muted)]">
                Мы уже передали его заведению — с вами свяжутся для подтверждения.
              </p>
              {orderId && (
                <a
                  href={`/order/${orderId}`}
                  className="mn-press mt-3 block w-full rounded-2xl bg-[var(--mn-accent)] px-4 py-4 text-center text-[15px] font-bold text-[color:var(--mn-on-accent)]"
                >
                  Следить за заказом
                </a>
              )}
              <button
                onClick={onClose}
                className="mn-press w-full rounded-2xl bg-[var(--mn-card)] px-4 py-4 text-[15px] font-semibold"
              >
                Вернуться в меню
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
