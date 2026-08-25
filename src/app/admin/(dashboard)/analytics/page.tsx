import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const [{ data: stats }, { data: venues }, { data: popularDishes }] = await Promise.all([
    supabase.from("venue_stats").select("*"),
    supabase.from("venues").select("id, name, slug"),
    supabase
      .from("dishes")
      .select("id, name, price, currency, venue_id, is_popular")
      .eq("is_popular", true)
      .limit(20),
  ]);

  const venueById = new Map((venues ?? []).map((v) => [v.id, v]));

  const totalViews = (stats ?? []).reduce((s, x) => s + (x.views_count ?? 0), 0);
  const totalScans = (stats ?? []).reduce((s, x) => s + (x.scans_count ?? 0), 0);

  const topByViews = [...(stats ?? [])]
    .sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0))
    .slice(0, 8);
  const topByScans = [...(stats ?? [])]
    .sort((a, b) => (b.scans_count ?? 0) - (a.scans_count ?? 0))
    .slice(0, 8);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold">Аналитика</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Всего просмотров" value={totalViews} />
        <StatCard label="Всего QR-сканирований" value={totalScans} />
        <StatCard label="Заведений" value={venues?.length ?? 0} />
        <StatCard label="Популярных блюд" value={popularDishes?.length ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Популярные заведения (просмотры)</h2>
          <RankedList
            items={topByViews.map((s) => ({
              label: venueById.get(s.venue_id ?? "")?.name ?? "—",
              value: s.views_count ?? 0,
            }))}
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-neutral-300">Популярные заведения (QR)</h2>
          <RankedList
            items={topByScans.map((s) => ({
              label: venueById.get(s.venue_id ?? "")?.name ?? "—",
              value: s.scans_count ?? 0,
            }))}
          />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-neutral-300">Отмеченные как «Популярное»</h2>
        <div className="space-y-1.5">
          {popularDishes?.map((d) => (
            <div key={d.id} className="flex justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm">
              <span>
                {d.name} <span className="text-neutral-500">· {venueById.get(d.venue_id)?.name}</span>
              </span>
              <span className="text-neutral-400">{d.price} {d.currency}</span>
            </div>
          ))}
          {!popularDishes?.length && <p className="text-sm text-neutral-500">Пока нет блюд с меткой «Популярное».</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RankedList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="text-sm">
          <div className="mb-1 flex justify-between text-neutral-300">
            <span>{item.label}</span>
            <span className="text-neutral-500">{item.value}</span>
          </div>
          <div className="h-1.5 rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {!items.length && <p className="text-sm text-neutral-500">Пока нет данных.</p>}
    </div>
  );
}
