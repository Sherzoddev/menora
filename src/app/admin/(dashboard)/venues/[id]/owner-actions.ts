"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function revokeOwner(venueId: string, ownerRowId: string) {
  const supabase = await createClient();
  await supabase.from("venue_users").delete().eq("id", ownerRowId);
  revalidatePath(`/admin/venues/${venueId}`);
}
