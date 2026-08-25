import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import {
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
} from "@/app/admin/(dashboard)/venues/[id]/promo/actions";
import { ConfirmButton } from "@/components/confirm-button";
import { Trash2 } from "lucide-react";

export default async function CabinetPromoPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();
  const { data: codes } = await supabase
    .from("promo_codes")
    .select("*")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Промокоды</h1>

      <form action={createPromoCode.bind(null, venueId)} className="mb-6 flex flex-wrap items-end gap-2">
        <Field label="Код">
          <input name="code" placeholder="WELCOME10" required className="input w-32 uppercase" />
        </Field>
        <Field label="Тип">
          <select name="discount_type" className="input w-28">
            <option value="percent">%</option>
            <option value="fixed">Сум</option>
          </select>
        </Field>
        <Field label="Размер">
          <input name="discount_value" type="number" min={1} step={1} placeholder="10" required className="input w-24" />
        </Field>
        <Field label="Лимит использований">
          <input name="max_uses" type="number" min={1} step={1} placeholder="без лимита" className="input w-32" />
        </Field>
        <button className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400">
          Создать
        </button>
      </form>

      <div className="space-y-2">
        {codes?.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div>
              <p className="font-mono text-sm font-medium">{c.code}</p>
              <p className="text-xs text-neutral-500">
                {c.discount_type === "percent" ? `-${c.discount_value}%` : `-${c.discount_value} сум`}
                {" · "}
                Использован {c.used_count}
                {c.max_uses != null ? ` из ${c.max_uses}` : " раз(а)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={togglePromoCode.bind(null, venueId, c.id, !c.is_active)}>
                <button
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    c.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {c.is_active ? "Активен" : "Отключён"}
                </button>
              </form>
              <form action={deletePromoCode.bind(null, venueId, c.id)}>
                <ConfirmButton message={`Удалить промокод «${c.code}»?`} className="text-neutral-500 hover:text-red-400">
                  <Trash2 size={14} />
                </ConfirmButton>
              </form>
            </div>
          </div>
        ))}

        {!codes?.length && <p className="text-sm text-neutral-500">Промокодов пока нет.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-400">
      {label}
      {children}
    </label>
  );
}
