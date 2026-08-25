import QRCode from "qrcode";
import { FONT_FAMILY, escapeXml } from "./svg-render";

export type QrVariant = "table" | "door" | "counter" | "print";

const VARIANT_CONFIG: Record<QrVariant, { width: number; height: number; caption: string; qrSize: number }> = {
  table: { width: 500, height: 640, caption: "Отсканируйте, чтобы открыть меню", qrSize: 380 },
  door: { width: 500, height: 500, caption: "Меню внутри — сканируйте", qrSize: 380 },
  counter: { width: 700, height: 460, caption: "Наше меню онлайн", qrSize: 320 },
  print: { width: 900, height: 1200, caption: "Отсканируйте QR-код, чтобы открыть меню", qrSize: 620 },
};

function extractSvgInner(svg: string) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return match ? match[1] : svg;
}

export async function buildQrSvg(url: string, venueName: string, variant?: QrVariant, table?: string) {
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 0, color: { dark: "#111111", light: "#ffffff" } });

  if (!variant) {
    return qrSvg;
  }

  const cfg = VARIANT_CONFIG[variant];
  const inner = extractSvgInner(qrSvg);
  const qrX = (cfg.width - cfg.qrSize) / 2;
  const qrY = 90;

  // A table QR shows the table number, not the venue name — every table's
  // poster otherwise looks identical at a glance, which is exactly what
  // caused mix-ups when sticking them onto tables.
  const titleText = table ? `Стол №${table}` : venueName;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cfg.width}" height="${cfg.height}" viewBox="0 0 ${cfg.width} ${cfg.height}">
    <rect width="${cfg.width}" height="${cfg.height}" fill="#ffffff" />
    <rect x="16" y="16" width="${cfg.width - 32}" height="${cfg.height - 32}" fill="none" stroke="#111111" stroke-width="2" />
    <text x="${cfg.width / 2}" y="55" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="30" fill="#111111">${escapeXml(titleText)}</text>
    <g transform="translate(${qrX}, ${qrY})">
      <svg width="${cfg.qrSize}" height="${cfg.qrSize}" viewBox="0 0 ${extractViewBoxSize(qrSvg)} ${extractViewBoxSize(qrSvg)}">${inner}</svg>
    </g>
    <text x="${cfg.width / 2}" y="${qrY + cfg.qrSize + 50}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="22" fill="#333333">${escapeXml(cfg.caption)}</text>
    <text x="${cfg.width / 2}" y="${cfg.height - 30}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="14" fill="#999999">Menora</text>
  </svg>`;
}

function extractViewBoxSize(svg: string) {
  const match = svg.match(/viewBox="0 0 (\d+) \d+"/);
  return match ? match[1] : "100";
}
