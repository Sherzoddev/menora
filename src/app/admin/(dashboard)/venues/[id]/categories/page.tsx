import { createClient } from "@/lib/supabase/server";
import { createCategory, updateCategory, deleteCategory, moveCategory } from "./actions";
import CategoryImageUploader from "./category-image-uploader";
import { ConfirmButton } from "@/components/confirm-button";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";

export default async function CategoriesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = await params;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("venue_id", venueId)
    .order("sort_order", { ascending: true });

  return (
    <div className="max-w-2xl">
      <form action={createCategory.bind(null, venueId)} className="mb-6 flex gap-2">
        <input name="name" placeholder="Название (рус)" required className="input" />
        <input name="name_uz" placeholder="Nomi (uz)" className="input" />
        <button className="shrink-0 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-amber-400">
          Добавить
        </button>
      </form>

      <div className="space-y-2">
        {categories?.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-3">
            <CategoryImageUploader venueId={venueId} categoryId={c.id} currentUrl={c.image_url} />
            <div className="flex flex-col">
              <form action={moveCategory.bind(null, venueId, c.id, "up")}>
                <button disabled={i === 0} className="text-neutral-500 hover:text-neutral-200 disabled:opacity-20">
                  <ArrowUp size={14} />
                </button>
              </form>
              <form action={moveCategory.bind(null, venueId, c.id, "down")}>
                <button
                  disabled={i === (categories?.length ?? 0) - 1}
                  className="text-neutral-500 hover:text-neutral-200 disabled:opacity-20"
                >
                  <ArrowDown size={14} />
                </button>
              </form>
            </div>

            <form action={updateCategory.bind(null, venueId, c.id)} className="flex flex-1 items-center gap-2">
              <input name="name" defaultValue={c.name} className="input flex-1" />
              <input name="name_uz" defaultValue={c.name_uz ?? ""} placeholder="uz" className="input flex-1" />
              <label className="flex shrink-0 items-center gap-1 text-xs text-neutral-400">
                <input type="checkbox" name="is_active" defaultChecked={c.is_active} />
                Активна
              </label>
              <button className="shrink-0 rounded-md border border-neutral-700 px-2 py-1 text-xs hover:border-amber-500">
                Сохранить
              </button>
            </form>

            <form action={deleteCategory.bind(null, venueId, c.id)}>
              <ConfirmButton
                message={`Удалить категорию «${c.name}»? Блюда в ней тоже удалятся.`}
                className="text-neutral-500 hover:text-red-400"
              >
                <Trash2 size={14} />
              </ConfirmButton>
            </form>
          </div>
        ))}

        {!categories?.length && <p className="text-sm text-neutral-500">Категорий пока нет.</p>}
      </div>
    </div>
  );
}
