import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TvView from "./tv-view";

export const dynamic = "force-dynamic";

export default async function TvMenuPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!venue) notFound();

  const [{ data: categories }, { data: dishes }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("dishes")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("is_available", true)
      .eq("out_of_stock", false)
      .order("sort_order"),
  ]);

  return <TvView venue={venue} categories={categories ?? []} dishes={dishes ?? []} />;
}
