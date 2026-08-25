import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function VenueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("id, name, slug").eq("id", id).single();

  if (!venue) notFound();

  const tabs = [
    { href: `/admin/venues/${id}`, label: "Инфо" },
    { href: `/admin/venues/${id}/categories`, label: "Категории" },
    { href: `/admin/venues/${id}/dishes`, label: "Блюда" },
    { href: `/admin/venues/${id}/orders`, label: "Заказы" },
    { href: `/admin/venues/${id}/promo`, label: "Промокоды" },
    { href: `/admin/venues/${id}/loyalty`, label: "Бонусы" },
    { href: `/admin/venues/${id}/reviews`, label: "Отзывы" },
    { href: `/admin/venues/${id}/qr`, label: "QR" },
    { href: `/admin/venues/${id}/poster`, label: "Постеры" },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="text-xs text-neutral-500 hover:text-neutral-300">
          ← Все заведения
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{venue.name}</h1>
        <p className="text-sm text-neutral-500">/{venue.slug}</p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-neutral-800 [scrollbar-width:none]">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="shrink-0 rounded-t-lg px-3 py-2 text-sm text-neutral-400 hover:text-neutral-100"
          >
            {t.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
