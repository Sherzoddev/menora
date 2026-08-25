import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Resolves the venue owned by the currently logged-in cabinet user. */
export async function getOwnerVenueId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/cabinet/login");

  const { data: ownerRow } = await supabase
    .from("venue_users")
    .select("venue_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!ownerRow) redirect("/cabinet/login");

  return ownerRow.venue_id;
}
