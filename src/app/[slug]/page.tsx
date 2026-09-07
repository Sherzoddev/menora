import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Script from "next/script";
import { createClient } from "@/lib/supabase/server";
import MenuView from "./menu-view";

export const dynamic = "force-dynamic";

// Explicit column list — never select("*") here: venues also carries
// telegram_chat_id/telegram_connect_code, which must not reach the public
// page's client bundle (see [slug]/menu-view.tsx PublicVenue type).
const PUBLIC_VENUE_COLUMNS =
  "id, slug, name, description, logo_url, cover_url, address, phone, instagram, telegram, working_hours, languages, primary_color, accent_color, is_active, latitude, longitude, delivery_radius_km";

async function getVenueData(slug: string) {
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select(PUBLIC_VENUE_COLUMNS)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!venue) return null;

  const [{ data: categories }, { data: dishes }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("dishes").select("*").eq("venue_id", venue.id).order("sort_order"),
  ]);

  return { venue, categories: categories ?? [], dishes: dishes ?? [] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getVenueData(slug);
  if (!data) return {};

  return {
    title: `${data.venue.name} — меню`,
    description: data.venue.description ?? undefined,
    openGraph: {
      title: data.venue.name,
      images: data.venue.cover_url ? [data.venue.cover_url] : undefined,
    },
  };
}

export default async function PublicMenuPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string; table?: string }>;
}) {
  const { slug } = await params;
  const { src, table } = await searchParams;
  const data = await getVenueData(slug);

  if (!data) notFound();

  return (
    <>
      {/* Harmless outside Telegram — window.Telegram.WebApp simply won't
          exist for a normal browser visitor. Lets this same page double as
          the venue's Telegram Mini App (see checkout-form.tsx).
          strategy="lazyOnload": the SDK writes CSS vars onto <html style>
          the moment it loads, which React reports as a hydration mismatch
          (suppressHydrationWarning on <html> doesn't cover attributes, only
          text content) if it runs any earlier than the window "load" event —
          it isn't needed before then anyway, only before checkout. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="lazyOnload" />
      <MenuView
        venue={data.venue}
        categories={data.categories}
        dishes={data.dishes}
        source={src}
        table={table}
      />
    </>
  );
}
