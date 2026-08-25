import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPosterSvg, type PosterFormat } from "@/lib/poster";
import { renderSvgToPng } from "@/lib/svg-render";

const VALID_FORMATS: PosterFormat[] = ["a4", "a3", "ig-post", "ig-story"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dishId: string }> },
) {
  const { dishId } = await params;
  const { searchParams } = new URL(request.url);
  const formatParam = searchParams.get("format") ?? "ig-post";
  const output = (searchParams.get("output") ?? "png").toLowerCase();

  if (!VALID_FORMATS.includes(formatParam as PosterFormat)) {
    return NextResponse.json({ error: "unsupported format" }, { status: 400 });
  }
  const format = formatParam as PosterFormat;

  const supabase = await createClient();
  const { data: dish } = await supabase.from("dishes").select("*").eq("id", dishId).single();
  if (!dish) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: venue } = await supabase
    .from("venues")
    .select("name, logo_url, accent_color")
    .eq("id", dish.venue_id)
    .single();
  if (!venue) return NextResponse.json({ error: "not found" }, { status: 404 });

  const svg = await buildPosterSvg(dish, venue, format);

  if (output === "svg") {
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `inline; filename="poster-${dishId}-${format}.svg"`,
      },
    });
  }

  const png = renderSvgToPng(svg);

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="poster-${dishId}-${format}.png"`,
    },
  });
}
