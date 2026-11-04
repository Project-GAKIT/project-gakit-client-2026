import { cachedGet } from '@/lib/backend/apiCache';
import { SATELLITE_PREFIX, parseSatelliteManifest, publicSatelliteBase, recentPublishedScans,
  satelliteObjectPath } from '@/lib/map/himawariPublication';

/** Public reads only; never imports the renderer or contacts CIRA. */
export async function publishedHimawari() {
  const base = publicSatelliteBase();
  const manifest = await cachedGet(`published-himawari:${base}`, 15_000, async () => {
    // A changing query isolates mutable-manifest reads from older CDN responses.
    const response = await fetch(`${base}/${SATELLITE_PREFIX}/latest.json?t=${Math.floor(Date.now() / 15_000)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Published satellite manifest unavailable');
    return parseSatelliteManifest(await response.json());
  });
  const scans = recentPublishedScans(manifest);
  if (!scans.length) throw new Error('Published satellite frames are too old');
  return { frames: scans.map(f => f.stamp),
    image_urls: Object.fromEntries(scans.map(f => [f.stamp, `${base}/${satelliteObjectPath(f.stamp)}`])),
    generated_at: manifest.generated_at, observed_at: scans.at(-1)!.stamp,
    source: 'JMA / RAMMB / CIRA · Himawari Band 13' };
}
