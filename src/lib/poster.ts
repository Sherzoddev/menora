import { formatPrice } from "@/lib/menu-utils";
import { FONT_FAMILY, escapeXml } from "@/lib/svg-render";

export type PosterFormat = "a4" | "a3" | "ig-post" | "ig-story";

const FORMAT_CONFIG: Record<PosterFormat, { width: number; height: number }> = {
  a4: { width: 1240, height: 1754 },
  a3: { width: 1754, height: 2481 },
  "ig-post": { width: 1080, height: 1080 },
  "ig-story": { width: 1080, height: 1920 },
};

async function toDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function wrapText(text: string, maxChars: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines;
}

export async function buildPosterSvg(
  dish: { name: string; description: string | null; price: number; discount_price: number | null; currency: string; photo_url: string | null },
  venue: { name: string; logo_url: string | null; accent_color: string | null },
  format: PosterFormat,
) {
  const { width, height } = FORMAT_CONFIG[format];
  const [photoUri, logoUri] = await Promise.all([toDataUri(dish.photo_url), toDataUri(venue.logo_url)]);

  const accent = venue.accent_color || "#c9a227";
  const photoHeight = Math.round(height * 0.62);
  const panelY = photoHeight;
  const panelHeight = height - photoHeight;

  const price = dish.discount_price != null ? dish.discount_price : dish.price;
  const priceLabel = formatPrice(price, dish.currency);
  const oldPriceLabel = dish.discount_price != null ? formatPrice(dish.price, dish.currency) : null;

  const descLines = dish.description ? wrapText(dish.description, Math.round(width / 22), 3) : [];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#111111" />
    ${photoUri
      ? `<image href="${photoUri}" x="0" y="0" width="${width}" height="${photoHeight}" preserveAspectRatio="xMidYMid slice" />`
      : `<rect x="0" y="0" width="${width}" height="${photoHeight}" fill="#262626" />`}
    <rect x="0" y="${photoHeight - 120}" width="${width}" height="120" fill="url(#fade)" />
    <defs>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#111111" stop-opacity="0" />
        <stop offset="1" stop-color="#111111" stop-opacity="1" />
      </linearGradient>
    </defs>

    <rect x="0" y="${panelY}" width="${width}" height="${panelHeight}" fill="#111111" />

    ${logoUri ? `<image href="${logoUri}" x="${width * 0.06}" y="${panelY + 30}" width="70" height="70" />` : ""}
    <text x="${logoUri ? width * 0.06 + 86 : width * 0.06}" y="${panelY + 72}" font-family="${FONT_FAMILY}" font-size="30" fill="#999999">${escapeXml(venue.name)}</text>

    <text x="${width * 0.06}" y="${panelY + 150}" font-family="${FONT_FAMILY}" font-size="56" font-weight="700" fill="#ffffff">${escapeXml(dish.name)}</text>

    ${descLines
      .map(
        (line, i) =>
          `<text x="${width * 0.06}" y="${panelY + 200 + i * 40}" font-family="${FONT_FAMILY}" font-size="28" fill="#bbbbbb">${escapeXml(line)}</text>`,
      )
      .join("")}

    ${oldPriceLabel
      ? `<text x="${width * 0.06}" y="${height - 60}" font-family="${FONT_FAMILY}" font-size="30" fill="#777777" text-decoration="line-through">${escapeXml(oldPriceLabel)}</text>
         <text x="${width * 0.06 + oldPriceLabel.length * 18 + 30}" y="${height - 60}" font-family="${FONT_FAMILY}" font-size="46" font-weight="700" fill="${accent}">${escapeXml(priceLabel)}</text>`
      : `<text x="${width * 0.06}" y="${height - 60}" font-family="${FONT_FAMILY}" font-size="46" font-weight="700" fill="${accent}">${escapeXml(priceLabel)}</text>`}
  </svg>`;
}

export { FORMAT_CONFIG };
