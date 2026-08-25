"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const FORMATS = [
  { key: "a4", label: "A4 (печать)" },
  { key: "a3", label: "A3 (печать)" },
  { key: "ig-post", label: "Instagram Post" },
  { key: "ig-story", label: "Instagram Story" },
];

export default function PosterPicker({ dishes }: { dishes: { id: string; name: string; photo_url: string | null }[] }) {
  const [dishId, setDishId] = useState(dishes[0]?.id ?? "");
  const [format, setFormat] = useState("ig-post");

  const previewUrl = dishId ? `/api/poster/${dishId}?format=${format}` : "";

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Блюдо</label>
          <select value={dishId} onChange={(e) => setDishId(e.target.value)} className="input">
            {dishes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-400">Формат</label>
          <div className="flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFormat(f.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs ${
                  format === f.key ? "border-amber-500 text-amber-400" : "border-neutral-700 text-neutral-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {previewUrl && (
          <a
            href={`${previewUrl}&download=1`}
            download
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400"
          >
            <Download size={14} /> Скачать PNG
          </a>
        )}
      </div>

      <div className="flex items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="poster preview" className="max-h-[420px] w-auto rounded-lg" />
        ) : (
          <p className="text-sm text-neutral-500">Выберите блюдо</p>
        )}
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #404040;
          background: #262626;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: #f5f5f5;
          outline: none;
        }
      `}</style>
    </div>
  );
}
