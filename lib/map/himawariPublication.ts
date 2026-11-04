/** Shared contract for completed images. No credentials or renderer imports. */
export const SATELLITE_BUCKET = 'satellite-frames';
export const SATELLITE_PREFIX = 'himawari-v2';
export const SATELLITE_RETENTION_MS = 2 * 60 * 60_000;
export const SATELLITE_FRAME_COUNT = 6;
export type PublishedScan = { stamp: string; bytes: number; sha256: string };
export type SatelliteManifest = {
  schema: 'himawari-publication-v2';
  generated_at: string;
  frames: PublishedScan[];
};

export function scanEpoch(stamp: string): number {
  if (!/^\d{14}$/.test(stamp)) return NaN;
  const t = Date.UTC(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8),
    +stamp.slice(8, 10), +stamp.slice(10, 12), +stamp.slice(12, 14));
  return Number.isFinite(t) && new Date(t).toISOString().replace(/\D/g, '').slice(0, 14) === stamp ? t : NaN;
}

export function parseSatelliteManifest(value: unknown): SatelliteManifest {
  const m = value as SatelliteManifest | null;
  if (!m || m.schema !== 'himawari-publication-v2' || !Number.isFinite(Date.parse(m.generated_at))
    || !Array.isArray(m.frames) || !m.frames.length || m.frames.length > SATELLITE_FRAME_COUNT
    || m.frames.some(f => !f || !Number.isFinite(scanEpoch(f.stamp)) || !Number.isInteger(f.bytes)
      || f.bytes < 33 || f.bytes > 8_000_000 || !/^[a-f0-9]{64}$/.test(f.sha256))
    || new Set(m.frames.map(f => f.stamp)).size !== m.frames.length) {
    throw new Error('Invalid published satellite manifest');
  }
  return m;
}

export function recentPublishedScans(manifest: SatelliteManifest, now = Date.now()): PublishedScan[] {
  return manifest.frames.filter(f => scanEpoch(f.stamp) <= now && now - scanEpoch(f.stamp) <= SATELLITE_RETENTION_MS)
    .sort((a, b) => a.stamp.localeCompare(b.stamp));
}

export function satelliteObjectPath(stamp: string): string {
  if (!Number.isFinite(scanEpoch(stamp))) throw new Error('Invalid satellite stamp');
  return `${SATELLITE_PREFIX}/frames/${stamp}.webp`;
}

export function publicSatelliteBase(url = process.env.NEXT_PUBLIC_SUPABASE_URL): string {
  if (!url) throw new Error('Supabase satellite storage URL is not configured');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('Satellite storage requires HTTPS');
  return `${parsed.origin}/storage/v1/object/public/${SATELLITE_BUCKET}`;
}
