import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DishForm from "./dish-form";
import DishPhotoUploader from "./dish-photo-uploader";
import { deleteDish } from "../actions";
import { ConfirmButton } from "@/components/confirm-button";

export default async function EditDishPage({
  params,
}: {
  params: Promise<{ id: string; dishId: string }>;
}) {
  const { id: venueId, dishId } = await params;
  const supabase = await createClient();

  const [{ data: dish }, { data: categories }] = await Promise.all([
    supabase.from("dishes").select("*").eq("id", dishId).single(),
    supabase.from("categories").select("id, name").eq("venue_id", venueId).order("sort_order"),
  ]);

  if (!dish) notFound();

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-8 sm:grid-cols-2">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-400">Фото блюда</p>
          <DishPhotoUploader venueId={venueId} dishId={dishId} currentUrl={dish.photo_url} />
        </div>

        <form action={deleteDish.bind(null, venueId, dishId, `/admin/venues/${venueId}/dishes`)}>
          <ConfirmButton
            message={`Удалить блюдо «${dish.name}»?`}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs text-red-400 hover:bg-red-950"
          >
            Удалить блюдо
          </ConfirmButton>
        </form>
      </div>

      <DishForm venueId={venueId} dish={dish} categories={categories ?? []} />
    </div>
  );
}
