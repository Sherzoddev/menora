import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Одному владельцу может принадлежать несколько заведений (несколько строк
// в venue_users с одним user_id) — этот cookie запоминает, какое из них
// сейчас активно в кабинете, чтобы не перелогиниваться при переключении.
// Устанавливается только через switchVenue (venue-switcher-actions.ts),
// которая проверяет, что заведение реально принадлежит текущему owner'у.
export const ACTIVE_VENUE_COOKIE = "menora_active_venue";

/** Resolves the venue owned by the currently logged-in cabinet user. */
export async function getOwnerVenueId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/cabinet/login");

  const { data: ownerRows } = await supabase
    .from("venue_users")
    .select("venue_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (!ownerRows || ownerRows.length === 0) redirect("/cabinet/login");

  const cookieStore = await cookies();
  const activeVenueId = cookieStore.get(ACTIVE_VENUE_COOKIE)?.value;
  const active = ownerRows.find((r) => r.venue_id === activeVenueId);

  return (active ?? ownerRows[0]).venue_id;
}

/** All venues this owner has access to, for the venue switcher. Empty for a single-venue owner. */
export async function getOwnerVenues(): Promise<{ id: string; name: string; slug: string }[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("venue_users")
    .select("venues(id, name, slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? [])
    .map((r) => r.venues as unknown as { id: string; name: string; slug: string } | null)
    .filter((v): v is { id: string; name: string; slug: string } => !!v);
}
