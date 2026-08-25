import { getOwnerVenueId } from "@/lib/cabinet";
import { createClient } from "@/lib/supabase/server";
import NewDishForm from "@/app/admin/(dashboard)/venues/[id]/dishes/new/new-dish-form";

export default async function CabinetNewDishPage() {
  const venueId = await getOwnerVenueId();
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("venue_id", venueId)
    .order("sort_order");

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Новое блюдо</h1>
      <NewDishForm venueId={venueId} categories={categories ?? []} basePath="/cabinet/dishes" />
    </div>
  );
}
