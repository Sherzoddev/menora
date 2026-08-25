import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import { markOrderDone, markOrderSent, deleteOrder } from "@/lib/orders-actions";
import { formatPrice } from "@/lib/menu-utils";
import { ConfirmButton } from "@/components/confirm-button";
import { Trash2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CabinetOrdersPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Заказы</h1>

      <div className="space-y-3">
        {orders?.map((o) => (
          <div key={o.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{o.customer_name} · {o.phone}</p>
                <p className="text-xs text-neutral-500">
                  {new Date(o.created_at).toLocaleString("ru-RU")} ·{" "}
                  {o.fulfillment === "delivery"
                    ? `Доставка: ${o.address}`
                    : o.fulfillment === "dine_in"
                      ? `За столом: ${o.table_number}`
                      : "Самовывоз"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={markOrderDone.bind(null, venueId, o.id, o.status !== "ready" && o.status !== "sent")}>
                  <button
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      o.status === "ready" || o.status === "sent"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400"
                    }`}
                  >
                    {o.status === "ready" || o.status === "sent" ? "Выполнен" : "Отметить выполненным"}
                  </button>
                </form>
                <form action={markOrderSent.bind(null, venueId, o.id)}>
                  <button
                    disabled={!!o.sent_at}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium disabled:cursor-default ${
                      o.sent_at ? "bg-sky-500/10 text-sky-400" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                    }`}
                  >
                    {o.sent_at ? "🛵 Отправлено" : "🛵 Отправить"}
                  </button>
                </form>
                <form action={deleteOrder.bind(null, venueId, o.id)}>
                  <ConfirmButton
                    message={`Удалить заказ «${o.customer_name}» на ${formatPrice(o.total, "UZS")}? Действие необратимо.`}
                    className="text-neutral-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </ConfirmButton>
                </form>
              </div>
            </div>

            <ul className="space-y-0.5 text-xs text-neutral-400">
              {o.order_items?.map((item) => (
                <li key={item.id}>
                  {item.dish_name} × {item.quantity} — {formatPrice(item.price * item.quantity, "UZS")}
                </li>
              ))}
            </ul>

            {(o.promo_code || o.points_redeemed > 0) && (
              <p className="mt-2 text-xs text-emerald-400">
                {o.promo_code && `Промокод ${o.promo_code}`}
                {o.promo_code && o.points_redeemed > 0 && " · "}
                {o.points_redeemed > 0 && `Списано баллов: ${o.points_redeemed}`}
                {" "}(-{formatPrice(o.discount, "UZS")})
              </p>
            )}
            {o.comment && <p className="mt-2 text-xs text-neutral-500">Комментарий: {o.comment}</p>}
            <p className="mt-2 text-sm font-semibold">{formatPrice(o.total, "UZS")}</p>
            {o.points_earned > 0 && (
              <p className="mt-0.5 text-[11px] text-neutral-500">+{o.points_earned} баллов гостю</p>
            )}
          </div>
        ))}

        {!orders?.length && <p className="text-sm text-neutral-500">Пока нет заказов.</p>}
      </div>
    </div>
  );
}
