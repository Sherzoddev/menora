// One-off generator for the PWA/app icons — run with `node scripts/generate-app-icons.mjs`
// whenever the brand mark or accent color changes. Output goes to /public.
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

const ACCENT = "#c9722c";
const ACCENT_DARK = "#7a4a1f";

function iconSvg(size) {
  const r = size * 0.22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${ACCENT}" />
      <stop offset="1" stop-color="${ACCENT_DARK}" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#g)" />
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, sans-serif" font-weight="700" font-size="${size * 0.52}" fill="#FBF3E6">M</text>
</svg>`;
}

for (const size of [192, 512]) {
  const png = new Resvg(iconSvg(size)).render().asPng();
  writeFileSync(join(publicDir, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png`);
}

const applePng = new Resvg(iconSvg(180)).render().asPng();
writeFileSync(join(publicDir, "apple-touch-icon.png"), applePng);
console.log("wrote apple-touch-icon.png");
