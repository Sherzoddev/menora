import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Landing page a table/door/counter QR code points to — not everyone has
// Telegram, so this lets the guest pick before committing to either path,
// instead of the QR silently assuming one or the other.
export default async function ScanChoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ table?: string }>;
}) {
  const { slug } = await params;
  const { table } = await searchParams;

  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, logo_url, accent_color, telegram_bot_username")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!venue) notFound();

  await supabase.from("analytics_events").insert({ venue_id: venue.id, event_type: "qr_scan" });

  const accent = venue.accent_color || "#c9722c";
  const browserUrl = `/${slug}${table ? `?table=${encodeURIComponent(table)}` : ""}`;
  const telegramUrl = venue.telegram_bot_username
    ? `https://t.me/${venue.telegram_bot_username}${table ? `?start=table_${encodeURIComponent(table)}` : ""}`
    : null;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#FBF3E6] px-6 text-center text-[#3a2f22]">
      {venue.logo_url && (
        <div className="relative mb-4 h-20 w-20 overflow-hidden rounded-full border-4 border-white shadow-md">
          <Image src={venue.logo_url} alt={venue.name} fill sizes="80px" className="object-cover" />
        </div>
      )}
      <h1 className="mb-1 text-xl font-bold">{venue.name}</h1>
      {table && <p className="mb-6 text-sm text-[#8a7a63]">Стол №{table}</p>}
      <p className="mb-6 text-sm text-[#8a7a63]">Как вам удобнее сделать заказ?</p>

      <div className="w-full max-w-xs space-y-3">
        {telegramUrl && (
          <a
            href={telegramUrl}
            className="block w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm"
            style={{ background: "#229ED9" }}
          >
            ✈️ Открыть в Telegram
          </a>
        )}
        <a
          href={browserUrl}
          className="block w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm"
          style={{ background: accent }}
        >
          🌐 Открыть меню в браузере
        </a>
      </div>
    </div>
  );
}
