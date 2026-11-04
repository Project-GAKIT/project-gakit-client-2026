import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { encodeSatelliteWebP } from '@/lib/server/himawariEncoding';

describe('lossless satellite delivery', () => {
  it('preserves every visible RGB value and alpha across the format conversion', async () => {
    const raw = Buffer.alloc(1800 * 1180 * 4);
    const alpha = [0, 1, 127, 255];
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = i % 255; raw[i + 1] = (i >> 3) % 255; raw[i + 2] = (i >> 7) % 255;
      raw[i + 3] = alpha[(i / 4) % 4];
    }
    const png = await sharp(raw, { raw: { width: 1800, height: 1180, channels: 4 } }).png().toBuffer();
    const encoded = await encodeSatelliteWebP(png);
    const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer();
    let differences = 0;
    for (let i = 0; i < raw.length; i += 4) {
      if (raw[i + 3] !== decoded[i + 3]) differences++;
      if (raw[i + 3] > 0 && !raw.subarray(i, i + 3).equals(decoded.subarray(i, i + 3))) differences++;
    }
    expect(differences).toBe(0);
    expect((await sharp(encoded).metadata()).format).toBe('webp');
  });
  it('rejects an input with incompatible geometry', async () => {
    const small = await sharp({ create: { width: 1, height: 1, channels: 4, background: 'red' } }).png().toBuffer();
    await expect(encodeSatelliteWebP(small)).rejects.toThrow('dimensions');
  });
});
