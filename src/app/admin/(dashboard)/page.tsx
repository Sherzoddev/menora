import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { QrCode, Tv2, Image as ImageIcon, Pencil, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ data: venues }, { data: stats }, { count: dishesCount }] = await Promise.all([
    supabase.from("venues").select("*").order("created_at", { ascending: false }),
    supabase.from("venue_stats").select("*"),
    supabase.from("dishes").select("*", { count: "exact", head: true }),
  ]);

  const statsByVenue = new Map((stats ?? []).map((s) => [s.venue_id, s]));

  const total = venues?.length ?? 0;
  const active = venues?.filter((v) => v.is_active).length ?? 0;
  const hidden = total - active;
  const totalViews = (stats ?? []).reduce((sum, s) => sum + (s.views_count ?? 0), 0);
  const totalScans = (stats ?? []).reduce((sum, s) => sum + (s.scans_count ?? 0), 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Дашборд</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Заведения" value={total} />
        <StatCard label="Активные" value={active} />
        <StatCard label="Скрытые" value={hidden} />
        <StatCard label="Блюда" value={dishesCount ?? 0} />
        <StatCard label="Просмотры" value={totalViews} />
        <StatCard label="QR-сканирования" value={totalScans} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Заведения</h2>
        <Link
          href="/admin/venues/new"
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-amber-400"
        >
          + Новое заведение
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {venues?.map((v) => {
          const s = statsByVenue.get(v.id);
          return (
            <div
              key={v.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-800">
                  {v.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.logo_url} alt={v.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{v.name}</p>
                  <p className="text-xs text-neutral-500">/{v.slug}</p>
                </div>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    v.is_active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-neutral-700/50 text-neutral-400"
                  }`}
                >
                  {v.is_active ? "Активно" : "Скрыто"}
                </span>
              </div>

              <div className="mb-3 grid grid-cols-3 gap-2 text-center text-xs text-neutral-400">
                <div>
                  <div className="font-medium text-neutral-100">{s?.dishes_count ?? 0}</div>
                  Блюд
                </div>
                <div>
                  <div className="font-medium text-neutral-100">{s?.views_count ?? 0}</div>
                  Просмотров
                </div>
                <div>
                  <div className="font-medium text-neutral-100">{s?.scans_count ?? 0}</div>
                  QR
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <IconLink href={`/admin/venues/${v.id}`} icon={<Pencil size={13} />} label="Ред." />
                <IconLink
                  href={`/${v.slug}`}
                  icon={<ExternalLink size={13} />}
                  label="Меню"
                  external
                />
                <IconLink href={`/admin/venues/${v.id}/qr`} icon={<QrCode size={13} />} label="QR" />
                <IconLink href={`/tv/${v.slug}`} icon={<Tv2 size={13} />} label="TV" external />
                <IconLink
                  href={`/admin/venues/${v.id}/poster`}
                  icon={<ImageIcon size={13} />}
                  label="Постер"
                />
              </div>
            </div>
          );
        })}

        {total === 0 && (
          <p className="text-sm text-neutral-500">
            Пока нет заведений. Нажмите «+ Новое заведение», чтобы создать первое.
          </p>
        )}
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

function IconLink({
  href,
  icon,
  label,
  external,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300 hover:border-amber-500 hover:text-amber-400"
    >
      {icon}
      {label}
    </Link>
  );
}
