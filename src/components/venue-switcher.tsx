"use client";

import { useRef, useState } from "react";
import { ChevronsUpDown, Store } from "lucide-react";

export function VenueSwitcher({
  venues,
  activeVenueId,
  switchAction,
}: {
  venues: { id: string; name: string; slug: string }[];
  activeVenueId: string;
  switchAction: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = venues.find((v) => v.id === activeVenueId);

  if (venues.length < 2) return null;

  return (
    <div ref={containerRef} className="relative mb-4 px-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-left text-sm text-neutral-200 transition hover:border-neutral-700"
      >
        <Store size={14} className="shrink-0 text-neutral-500" />
        <span className="min-w-0 flex-1 truncate">{active?.name ?? "Заведение"}</span>
        <ChevronsUpDown size={14} className="shrink-0 text-neutral-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-lg">
            {venues.map((v) => (
              <form key={v.id} action={switchAction}>
                <input type="hidden" name="venueId" value={v.id} />
                <button
                  type="submit"
                  disabled={v.id === activeVenueId}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                    v.id === activeVenueId
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
