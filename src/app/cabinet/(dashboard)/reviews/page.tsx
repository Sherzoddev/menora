import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import { deleteRating } from "@/lib/ratings-actions";
import { computeRatingStats } from "@/lib/ratings";
import { ConfirmButton } from "@/components/confirm-button";
import { Trash2, Star } from "lucide-react";

export default async function CabinetReviewsPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();

  const { data: ratings } = await supabase
    .from("ratings")
    .select("id, rating, comment, tags, created_at, orders(customer_name)")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false });

  const list = ratings ?? [];
  const stats = computeRatingStats(list);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Отзывы</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Средняя оценка" value={stats.all.count ? `⭐ ${stats.all.avg.toFixed(1)}` : "—"} />
        <StatCard label="Сегодня" value={stats.today.count} />
        <StatCard label="7 дней" value={stats.last7.count} />
        <StatCard label="Всего оценок" value={stats.all.count} />
      </div>

      <div className="mb-6 space-y-1.5">
        {stats.distribution.map((d) => (
          <DistributionBar key={d.n} n={d.n} count={d.count} max={Math.max(1, ...stats.distribution.map((x) => x.count))} />
        ))}
      </div>

      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-medium">
                {"⭐".repeat(r.rating)}
                <span className="ml-2 text-xs text-neutral-500">{r.orders?.customer_name}</span>
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">{new Date(r.created_at).toLocaleString("ru-RU")}</span>
                <form action={deleteRating.bind(null, venueId, r.id)}>
                  <ConfirmButton message="Удалить отзыв?" className="text-neutral-500 hover:text-red-400">
                    <Trash2 size={14} />
                  </ConfirmButton>
                </form>
              </div>
            </div>
            {r.comment && <p className="text-sm text-neutral-300">{r.comment}</p>}
            {r.tags && r.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {r.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {!list.length && <p className="text-sm text-neutral-500">Пока нет отзывов.</p>}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DistributionBar({ n, count, max }: { n: number; count: number; max: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex w-10 shrink-0 items-center gap-0.5 text-neutral-400">
        {n} <Star size={12} />
      </span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
        <div className="h-full rounded-full bg-amber-500" style={{ width: `${(count / max) * 100}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right text-neutral-500">{count}</span>
    </div>
  );
}
