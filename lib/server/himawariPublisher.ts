import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { SATELLITE_FRAME_COUNT, SATELLITE_RETENTION_MS, scanEpoch, parseSatelliteManifest,
  type PublishedScan, type SatelliteManifest } from '@/lib/map/himawariPublication';

export interface SatellitePublicationStore {
  readManifest(): Promise<SatelliteManifest | null>;
  listFrames(): Promise<string[]>;
  readFrame(stamp: string): Promise<Buffer | null>;
  uploadFrame(stamp: string, png: Buffer): Promise<void>;
  publish(manifest: SatelliteManifest): Promise<void>;
  removeFrames(stamps: string[]): Promise<void>;
}

async function describe(stamp: string, image: Buffer): Promise<PublishedScan> {
  if (image.length < 33 || image.length > 8_000_000) throw new Error('Invalid satellite image size');
  const metadata = await sharp(image).metadata();
  if (metadata.format !== 'webp' || metadata.width !== 1800 || metadata.height !== 1180) {
    throw new Error('Satellite WebP dimensions/content differ from the publication contract');
  }
  return { stamp, bytes: image.length, sha256: createHash('sha256').update(image).digest('hex') };
}

/** Upload first, publish last, then delete only old managed objects outside the active manifest.
 * Run through one scheduler with overlap disabled; concurrent publishers are not supported.
 */
export async function publishSatelliteFrames(store: SatellitePublicationStore,
  discover: () => Promise<string[]>, render: (stamp: string) => Promise<Buffer>, now = Date.now()) {
  const previous = await store.readManifest();
  if (previous) parseSatelliteManifest(previous);
  const existing = new Set(await store.listFrames());
  let candidates: string[];
  let upstreamUnavailable = false;
  try { candidates = await discover(); }
  catch { candidates = []; upstreamUnavailable = true; }
  candidates = [...new Set([...candidates, ...(previous?.frames.map(f => f.stamp) ?? [])])]
    .filter(s => Number.isFinite(scanEpoch(s)) && scanEpoch(s) <= now && now - scanEpoch(s) <= SATELLITE_RETENTION_MS)
    .sort().reverse().slice(0, 8);
  const frames: PublishedScan[] = [];
  let rendered = 0;
  const failed: string[] = [];
  for (const stamp of candidates) {
    if (frames.length === SATELLITE_FRAME_COUNT) break;
    const known = previous?.frames.find(f => f.stamp === stamp);
    if (known && existing.has(stamp)) { frames.push(known); continue; }
    try {
      // Reuse an orphan left by an interrupted publication, without overwriting immutable URLs.
      const saved = existing.has(stamp) ? await store.readFrame(stamp) : null;
      const png = saved ?? await render(stamp);
      const frame = await describe(stamp, png);
      if (!saved) { await store.uploadFrame(stamp, png); rendered++; }
      frames.push(frame);
    } catch { failed.push(stamp); }
  }
  // An outage never replaces a usable publication with an empty list.
  if (!frames.length && previous) frames.push(...previous.frames.filter(f => existing.has(f.stamp)));
  if (!frames.length) throw new Error('No completed satellite frames could be published');
  const manifest: SatelliteManifest = { schema: 'himawari-publication-v2',
    generated_at: new Date(now).toISOString(), frames: frames.sort((a, b) => a.stamp.localeCompare(b.stamp)) };
  await store.publish(manifest);
  const protectedStamps = new Set(manifest.frames.map(f => f.stamp));
  const expired = [...existing].filter(s => Number.isFinite(scanEpoch(s))
    && now - scanEpoch(s) > SATELLITE_RETENTION_MS && !protectedStamps.has(s));
  // Failure here is visible to the scheduler, but the newly published feed remains valid.
  if (expired.length) await store.removeFrames(expired);
  return { published: frames.length, rendered, deleted: expired.length, failed,
    upstreamUnavailable, latest: manifest.frames.at(-1)!.stamp,
    delayed: now - scanEpoch(manifest.frames.at(-1)!.stamp) > 30 * 60_000 };
}
