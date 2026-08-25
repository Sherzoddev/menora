import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// De-duplicated with a short-lived per-visitor cookie so refreshing the menu
// or a scripted loop can't spam analytics_events for a scraped venue_id —
// each venue+event pair counts at most once per window.
const DEDUPE_WINDOW_SECONDS = 30 * 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const venueId = body?.venue_id as string | undefined;
  const eventType = body?.event_type as string | undefined;

  if (!venueId || (eventType !== "view" && eventType !== "qr_scan")) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  const cookieName = `mn_${eventType}_${venueId}`;
  const cookieStore = await cookies();
  if (cookieStore.get(cookieName)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("analytics_events").insert({ venue_id: venueId, event_type: eventType });
  if (error) {
    // Most likely an unknown venue_id tripping the foreign key — nothing to record.
    return NextResponse.json({ ok: true });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "1", {
    maxAge: DEDUPE_WINDOW_SECONDS,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
