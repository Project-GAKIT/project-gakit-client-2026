import sharp from 'sharp';

/** Preserve visible RGB and alpha relative to the existing palette PNG.
 * WebP may discard RGB beneath completely transparent pixels.
 */
export async function encodeSatelliteWebP(png: Buffer): Promise<Buffer> {
  const metadata = await sharp(png).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1800 || metadata.height !== 1180) {
    throw new Error('Unexpected satellite PNG dimensions or format');
  }
  return sharp(png).webp({ lossless: true, effort: 4 }).toBuffer();
}
