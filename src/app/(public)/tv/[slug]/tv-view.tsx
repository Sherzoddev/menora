"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/menu-utils";

type Venue = Tables<"venues">;
type Category = Tables<"categories">;
type Dish = Tables<"dishes">;

const SLIDE_SECONDS = 8;
const REFRESH_SECONDS = 60;

export default function TvView({
  venue,
  categories,
  dishes,
}: {
  venue: Venue;
  categories: Category[];
  dishes: Dish[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const nonEmptyCategories = useMemo(
    () => categories.filter((c) => dishes.some((d) => d.category_id === c.id)),
    [categories, dishes],
  );

  useEffect(() => {
    if (nonEmptyCategories.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % nonEmptyCategories.length);
    }, SLIDE_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [nonEmptyCategories.length]);

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), REFRESH_SECONDS * 1000);
    return () => clearInterval(timer);
  }, [router]);

  const current = nonEmptyCategories[index];
  const items = current ? dishes.filter((d) => d.category_id === current.id) : [];

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100"
      style={{ ["--accent" as string]: venue.accent_color || "#c9a227" }}
    >
      <header className="flex items-center gap-4 border-b border-neutral-900 px-10 py-6">
        {venue.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={venue.logo_url} alt={venue.name} className="h-14 w-14 rounded-xl object-cover" />
        )}
        <h1 className="text-3xl font-semibold tracking-tight">{venue.name}</h1>
        <div className="ml-auto flex gap-2">
          {nonEmptyCategories.map((c, i) => (
            <span
              key={c.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-8 bg-[var(--accent)]" : "w-2 bg-neutral-700"
              }`}
            />
          ))}
        </div>
      </header>

      {current ? (
        <main key={current.id} className="flex-1 animate-[fadein_0.6s_ease] overflow-hidden px-10 py-8">
          <h2 className="mb-6 text-4xl font-semibold text-[var(--accent)]">{current.name}</h2>
          <div className="grid grid-cols-3 gap-6">
            {items.slice(0, 9).map((d) => (
              <div key={d.id} className="flex items-center gap-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-800">
                  {d.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{d.name}</p>
                  <p className="mt-1 text-xl font-semibold text-[var(--accent)]">
                    {formatPrice(d.discount_price ?? d.price, d.currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </main>
      ) : (
        <main className="flex flex-1 items-center justify-center text-neutral-600">
          Меню пока пусто
        </main>
      )}

      <style jsx global>{`
        @keyframes fadein {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
