import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Download, Eye } from "lucide-react";
import { TableQrGenerator } from "@/components/table-qr-generator";

const VARIANTS: { key: string; label: string; hint: string }[] = [
  { key: "", label: "Обычный", hint: "Просто QR без рамки" },
  { key: "table", label: "На стол", hint: "Табличка-подставка" },
  { key: "door", label: "На дверь", hint: "Стикер для входа" },
  { key: "counter", label: "На стойку", hint: "Горизонтальная карточка" },
  { key: "print", label: "Для печати", hint: "Крупный постер A-формата" },
];

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: venue } = await supabase.from("venues").select("slug, name").eq("id", id).single();

  if (!venue) notFound();

  const menuUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/${venue.slug}`;

  return (
    <div className="max-w-3xl">
      <p className="mb-6 text-sm text-neutral-400">
        Ссылка на меню: <span className="text-neutral-200">{menuUrl}</span>
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANTS.map((v) => {
          const base = `/api/qr/${venue.slug}${v.key ? `?variant=${v.key}` : ""}`;
          const sep = v.key ? "&" : "?";
          return (
            <div key={v.key || "plain"} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="mb-3 flex items-center justify-center rounded-lg bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${base}${sep}format=png`} alt={v.label} className="h-40 w-40 object-contain" />
              </div>
              <p className="text-sm font-medium">{v.label}</p>
              <p className="mb-3 text-xs text-neutral-500">{v.hint}</p>
              <div className="flex flex-wrap gap-1.5">
                <a href={`${base}${sep}format=png`} download className="qr-btn">
                  <Download size={12} /> PNG
                </a>
                <a href={`${base}${sep}format=svg`} download className="qr-btn">
                  <Download size={12} /> SVG
                </a>
                <a href={`${base}${sep}format=pdf`} download className="qr-btn">
                  <Download size={12} /> PDF
                </a>
                <a href={`${base}${sep}format=png`} target="_blank" rel="noreferrer" className="qr-btn">
                  <Eye size={12} /> Открыть
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 max-w-sm">
        <TableQrGenerator slug={venue.slug} />
      </div>
    </div>
  );
}
