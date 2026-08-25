import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice, formatTime } from "@/lib/menu-utils";
import { OrderTracker } from "./order-tracker";

export const dynamic = "force-dynamic";

// Order tracking is intentionally unauthenticated: the order id (a random
// UUID, never enumerable) acts as the access token, the same pattern used
// by most checkout/receipt links. RLS has no public SELECT policy on
// orders, so this reads through the admin client rather than the request's
// own (anonymous) session.
async function getOrder(id: string) {
  const adminDb = createAdminClient();
  const { data: order } = await adminDb
    .from("orders")
    .select(
      "id, status, sent_at, total, discount, promo_code, points_earned, points_redeemed, fulfillment, address, table_number, created_at, order_items(id, dish_name, price, quantity), venues(name, accent_color)",
    )
    .eq("id", id)
    .maybeSingle();

  return order;
}

export default async function OrderTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) notFound();

  const accent = order.venues?.accent_color || "#c9722c";

  return (
    <div className="min-h-screen bg-[#FBF3E6] px-4 py-10 text-[#3a2f22]">
      <div className="mx-auto max-w-md">
        <p className="text-center text-xs text-[#8a7a63]">{order.venues?.name}</p>
        <h1 className="mt-1 text-center text-lg font-bold">Заказ от {formatTime(order.created_at)}</h1>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <OrderTracker
            orderId={order.id}
            initialStatus={order.status}
            initialSentAt={order.sent_at}
            fulfillment={order.fulfillment}
            accent={accent}
          />
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="mb-2 text-xs font-medium text-[#8a7a63]">
            {order.fulfillment === "delivery"
              ? `Доставка: ${order.address}`
              : order.fulfillment === "dine_in"
                ? `За столом №${order.table_number}`
                : "Самовывоз"}
          </p>
          <ul className="space-y-1.5 text-sm">
            {order.order_items?.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="text-[#5a4d3c]">
                  {item.dish_name} × {item.quantity}
                </span>
                <span className="shrink-0 font-medium">{formatPrice(item.price * item.quantity, "UZS")}</span>
              </li>
            ))}
          </ul>

          {(order.promo_code || order.points_redeemed > 0) && (
            <p className="mt-2 text-xs text-emerald-600">
              {order.promo_code && `Промокод ${order.promo_code}`}
              {order.promo_code && order.points_redeemed > 0 && " · "}
              {order.points_redeemed > 0 && `Списано баллов: ${order.points_redeemed}`} (-
              {formatPrice(order.discount, "UZS")})
            </p>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-[#f1e9da] pt-3 text-sm font-semibold">
            <span>Итого</span>
            <span>{formatPrice(order.total, "UZS")}</span>
          </div>
          {order.points_earned > 0 && (
            <p className="mt-1 text-[11px] text-[#8a7a63]">+{order.points_earned} баллов начислено</p>
          )}
        </div>
      </div>
    </div>
  );
}
