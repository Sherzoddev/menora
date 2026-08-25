import Link from "next/link";
import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import DishFlagToggles from "@/app/admin/(dashboard)/venues/[id]/dishes/dish-flag-toggles";

export default async function CabinetDishesPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();

  const [{ data: categories }, { data: dishes }] = await Promise.all([
    supabase.from("categories").select("*").eq("venue_id", venueId).order("sort_order"),
    supabase.from("dishes").select("*").eq("venue_id", venueId).order("sort_order"),
  ]);

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Блюда</h1>
        <Link
          href="/cabinet/dishes/new"
          className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400"
        >
          + Добавить блюдо
        </Link>
      </div>

      {!categories?.length && (
        <p className="text-sm text-neutral-500">
          Сначала создайте хотя бы одну категорию на вкладке «Категории».
        </p>
      )}

      {categories?.map((cat) => {
        const items = dishes?.filter((d) => d.category_id === cat.id) ?? [];
        return (
          <div key={cat.id} className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-neutral-300">{cat.name}</h2>
            <div className="space-y-2">
              {items.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3"
                >
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-neutral-800">
                    {d.photo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/cabinet/dishes/${d.id}`}
                      className="truncate text-sm font-medium hover:text-amber-400"
                    >
                      {d.name}
                    </Link>
                    <p className="text-xs text-neutral-500">
                      {d.discount_price ? (
                        <>
                          <span className="mr-1 line-through">{d.price} {d.currency}</span>
                          <span className="text-amber-400">{d.discount_price} {d.currency}</span>
                        </>
                      ) : (
                        <>{d.price} {d.currency}</>
                      )}
                    </p>
                  </div>
                  <DishFlagToggles venueId={venueId} dish={d} />
                </div>
              ))}
              {!items.length && <p className="text-xs text-neutral-600">Нет блюд в этой категории.</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
