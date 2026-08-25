"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteRating(venueId: string, ratingId: string) {
  const supabase = await createClient();
  await supabase.from("ratings").delete().eq("id", ratingId);
  revalidatePath(`/admin/venues/${venueId}/reviews`);
  revalidatePath("/cabinet/reviews");
}
