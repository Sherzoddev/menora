import { createClient } from "@/lib/supabase/server";
import { deleteLoyaltyBalance } from "@/lib/orders-actions";
import { POINT_VALUE } from "@/lib/loyalty";
import { formatPrice } from "@/lib/menu-utils";
import { ConfirmButton } from "@/components/confirm-button";
import { Trash2 } from "lucide-react";

export default async function LoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = await params;
  const supabase = await createClient();
  const [{ data: venue }, { data: balances }] = await Promise.all([
    supabase.from("venues").select("loyalty_percent").eq("id", venueId).single(),
    supabase.from("loyalty_points").select("*").eq("venue_id", venueId).order("points", { ascending: false }),
  ]);

  return (
    <div className="max-w-2xl">
      <p className="mb-6 text-sm text-neutral-400">
        Гость получает {venue?.loyalty_percent ?? 2}% от суммы каждого заказа бонусными баллами (1 балл ={" "}
        {formatPrice(POINT_VALUE, "UZS")}) и может списать их при следующем заказе. Процент меняется на странице
        «Инфо». Начисляется и списывается автоматически по номеру телефона при оформлении заказа.
      </p>

      <div className="space-y-2">
        {balances?.map((b) => (
          <div key={b.id} className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <p className="text-sm font-medium">{b.phone}</p>
            <div className="flex items-center gap-3">
              <p className="text-sm text-amber-400">{b.points} баллов</p>
              <form action={deleteLoyaltyBalance.bind(null, venueId, b.phone)}>
                <ConfirmButton
                  message={`Обнулить баллы для номера ${b.phone}?`}
                  className="text-neutral-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}

        {!balances?.length && <p className="text-sm text-neutral-500">Пока нет накопленных баллов.</p>}
      </div>
    </div>
  );
}
