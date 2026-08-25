import { createClient } from "@/lib/supabase/server";
import NewDishForm from "./new-dish-form";

export default async function NewDishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = await params;
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("venue_id", venueId)
    .order("sort_order");

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Новое блюдо</h1>
      <NewDishForm
        venueId={venueId}
        categories={categories ?? []}
        basePath={`/admin/venues/${venueId}/dishes`}
      />
    </div>
  );
}
