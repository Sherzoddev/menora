import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PT_SANS_REGULAR_BASE64 } from "./fonts/pt-sans-base64";
import { PT_SANS_BOLD_BASE64 } from "./fonts/pt-sans-bold-base64";

export const FONT_FAMILY = "PT Sans";

// QR/dish posters are rasterized server-side in a serverless environment
// with no system fonts installed, which used to render <text> as blank tofu
// boxes. resvg-js (not sharp/librsvg) does the rasterizing here because it
// takes embedded font *files* directly and shapes text itself — no
// fontconfig/system-font lookup involved. Fonts are embedded as base64 in
// the bundle (reliable across Vercel/Netlify builds) and written once per
// cold start to the writable /tmp dir, since resvg-js only accepts font
// paths, not buffers.
let fontPaths: string[] | null = null;

function ensureFontFiles(): string[] {
  if (fontPaths) return fontPaths;
  const dir = join(tmpdir(), "menora-fonts");
  mkdirSync(dir, { recursive: true });
  const regularPath = join(dir, "PTSans-Regular.ttf");
  const boldPath = join(dir, "PTSans-Bold.ttf");
  writeFileSync(regularPath, Buffer.from(PT_SANS_REGULAR_BASE64, "base64"));
  writeFileSync(boldPath, Buffer.from(PT_SANS_BOLD_BASE64, "base64"));
  fontPaths = [regularPath, boldPath];
  return fontPaths;
}

export function renderSvgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: ensureFontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
  });
  return resvg.render().asPng();
}

export function escapeXml(text: string) {
  return text.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
}
