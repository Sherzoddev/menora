import sharp from "sharp";

export async function resizeToWebp(
  file: File,
  { maxWidth, maxHeight, quality = 78 }: { maxWidth: number; maxHeight: number; quality?: number },
) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const output = await sharp(buffer)
    .rotate() // respect EXIF orientation from phone cameras
    .resize({ width: maxWidth, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  return output;
}
