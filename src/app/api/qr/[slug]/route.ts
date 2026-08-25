import { NextResponse } from "next/server";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { buildQrSvg, type QrVariant } from "@/lib/qr";
import { renderSvgToPng } from "@/lib/svg-render";

const VALID_VARIANTS: QrVariant[] = ["table", "door", "counter", "print"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") ?? "png").toLowerCase();
  const variantParam = searchParams.get("variant");
  const variant = VALID_VARIANTS.includes(variantParam as QrVariant)
    ? (variantParam as QrVariant)
    : undefined;
  const table = searchParams.get("table")?.trim();

  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("name, slug, is_active")
    .eq("slug", slug)
    .single();

  if (!venue) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Lands on the scan-choice page (browser vs Telegram bot) rather than the
  // menu directly — see src/app/[slug]/scan/page.tsx, which logs the
  // qr_scan analytics event itself.
  const menuUrl = `${siteUrl}/${venue.slug}/scan${table ? `?table=${encodeURIComponent(table)}` : ""}`;
  const fileSuffix = `${variant ? `-${variant}` : ""}${table ? `-t${table}` : ""}`;

  const svg = await buildQrSvg(menuUrl, venue.name, variant, table);

  if (format === "svg") {
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="qr-${slug}${fileSuffix}.svg"`,
      },
    });
  }

  const pngBuffer = renderSvgToPng(svg);

  if (format === "png") {
    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="qr-${slug}${fileSuffix}.png"`,
      },
    });
  }

  if (format === "pdf") {
    const metadata = await sharp(pngBuffer).metadata();
    const width = metadata.width ?? 500;
    const height = metadata.height ?? 500;

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([width, height]);
    const image = await pdfDoc.embedPng(pngBuffer);
    page.drawImage(image, { x: 0, y: 0, width, height });
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "public, max-age=86400",
        "Content-Disposition": `inline; filename="qr-${slug}${fileSuffix}.pdf"`,
      },
    });
  }

  return NextResponse.json({ error: "unsupported format" }, { status: 400 });
}
