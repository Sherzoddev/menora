"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBotLang, STAFF_TEXT } from "@/lib/bot-i18n";
import { notifyStaff } from "@/lib/venue-staff";

const COOLDOWN_MS = 2 * 60 * 1000;

// Guests have no Supabase session (same reason createOrder uses the admin
// client), so this needs the service-role client rather than the RLS-bound
// one — waiter_calls has no public insert/select policy on purpose.
export async function callWaiter(venueId: string, table?: string) {
  const supabase = createAdminClient();

  let cooldownQuery = supabase.from("waiter_calls").select("created_at").eq("venue_id", venueId);
  cooldownQuery = table ? cooldownQuery.eq("table_number", table) : cooldownQuery.is("table_number", null);
  const { data: recent } = await cooldownQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();

  if (recent && Date.now() - new Date(recent.created_at).getTime() < COOLDOWN_MS) {
    return { ok: true, alreadyCalled: true };
  }

  const { data: venue } = await supabase
    .from("venues")
    .select("telegram_chat_id, telegram_bot_token, staff_bot_language")
    .eq("id", venueId)
    .single();

  await supabase.from("waiter_calls").insert({ venue_id: venueId, table_number: table ?? null });

  if (venue?.telegram_bot_token) {
    const lang = resolveBotLang(venue.staff_bot_language);
    await notifyStaff(venue.telegram_bot_token, venueId, venue.telegram_chat_id, STAFF_TEXT[lang].waiterCallAlert(table ?? null));
  }

  return { ok: true, alreadyCalled: false };
}
