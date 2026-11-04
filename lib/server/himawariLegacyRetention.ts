import { scanEpoch, SATELLITE_RETENTION_MS } from '@/lib/map/himawariPublication';

/** Retire only the known PNG publication after its manifest AND all listed scans
 * have aged past the compatibility window. Unknown files are never removed.
 */
export function expiredLegacySatellitePaths(value: unknown, files: string[], now = Date.now()): string[] {
  const previous = value as { schema?: string; generated_at?: string; frames?: { stamp?: string }[] } | null;
  const cutoff = now - SATELLITE_RETENTION_MS;
  if (!previous || previous.schema !== 'himawari-publication-v1'
    || !Number.isFinite(Date.parse(previous.generated_at ?? '')) || Date.parse(previous.generated_at!) > cutoff
    || !Array.isArray(previous.frames) || !previous.frames.length || previous.frames.length > 6
    || previous.frames.some(f => !f || !Number.isFinite(scanEpoch(f.stamp ?? '')) || scanEpoch(f.stamp!) > cutoff)) return [];
  const managed = files.filter(f => /^\d{14}\.png$/.test(f) && Number.isFinite(scanEpoch(f.slice(0, 14))));
  const paths = managed.filter(f => scanEpoch(f.slice(0, 14)) < cutoff).map(f => 'himawari-v1/frames/' + f);
  if (managed.every(f => scanEpoch(f.slice(0, 14)) < cutoff)) paths.push('himawari-v1/latest.json');
  return paths;
}
