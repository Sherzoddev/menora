import { createClient } from "@/lib/supabase/server";
import PosterPicker from "./poster-picker";

export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: venueId } = await params;
  const supabase = await createClient();
  const { data: dishes } = await supabase
    .from("dishes")
    .select("id, name, photo_url")
    .eq("venue_id", venueId)
    .order("sort_order");

  return (
    <div className="max-w-2xl">
      {!dishes?.length ? (
        <p className="text-sm text-neutral-500">Сначала добавьте блюда, чтобы создавать постеры.</p>
      ) : (
        <PosterPicker dishes={dishes} />
      )}
    </div>
  );
}
