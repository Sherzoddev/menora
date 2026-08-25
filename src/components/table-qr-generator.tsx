"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function TableQrGenerator({ slug }: { slug: string }) {
  const [table, setTable] = useState("1");
  const trimmed = table.trim();
  const base = `/api/qr/${slug}?variant=table&table=${encodeURIComponent(trimmed)}`;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-neutral-900 p-4">
      <p className="text-sm font-medium">QR для стола</p>
      <p className="mb-3 text-xs text-neutral-500">
        Заказ по этому QR сразу помечается номером стола — без адреса и способа получения.
      </p>
      <label className="mb-3 block text-xs text-neutral-400">
        Номер / название стола
        <input
          value={table}
          onChange={(e) => setTable(e.target.value)}
          placeholder="напр. 5 или VIP-1"
          className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-500"
        />
      </label>

      {trimmed && (
        <>
          <div className="mb-3 flex items-center justify-center rounded-lg bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${base}&format=png`} alt={`Стол ${trimmed}`} className="h-40 w-40 object-contain" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <a href={`${base}&format=png`} download className="qr-btn">
              <Download size={12} /> PNG
            </a>
            <a href={`${base}&format=svg`} download className="qr-btn">
              <Download size={12} /> SVG
            </a>
            <a href={`${base}&format=pdf`} download className="qr-btn">
              <Download size={12} /> PDF
            </a>
          </div>
        </>
      )}
    </div>
  );
}
