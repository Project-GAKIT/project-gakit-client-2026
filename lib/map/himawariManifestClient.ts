import { SATELLITE_PREFIX, parseSatelliteManifest, publicSatelliteBase, recentPublishedScans,
  type SatelliteManifest } from './himawariPublication';

const pending = new Map<string, Promise<SatelliteManifest>>();
const cacheKey = (base: string) => `gakit:satellite-manifest:v2:${base}`;

function usable(value: unknown): SatelliteManifest {
  const manifest = parseSatelliteManifest(value);
  if (!recentPublishedScans(manifest).length) throw new Error('No recent published satellite frames available');
  return manifest;
}

function restored(base: string): SatelliteManifest | null {
  try {
    const saved = localStorage.getItem(cacheKey(base));
    if (saved) return usable(JSON.parse(saved));
  } catch { /* Invalid/stale data or blocked storage must not prevent live loading. */ }
  try { localStorage.removeItem(cacheKey(base)); } catch { /* Storage is optional. */ }
  return null;
}

function refresh(base: string): Promise<SatelliteManifest> {
  const existing = pending.get(base);
  if (existing) return existing;
  const request = (async () => {
    const response = await fetch(`${base}/${SATELLITE_PREFIX}/latest.json?t=${Math.floor(Date.now() / 15_000)}`, {
      cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Satellite frame list is temporarily unavailable');
    const manifest = usable(await response.json());
    try { localStorage.setItem(cacheKey(base), JSON.stringify(manifest)); } catch { /* Storage is optional. */ }
    return manifest;
  })().finally(() => { pending.delete(base); });
  pending.set(base, request);
  return request;
}

/** Completed local scans start immediately; the network refresh runs alongside image loading. */
export async function loadSatelliteManifest(options: {
  forceFresh?: boolean; onUpdated?: (manifest: SatelliteManifest) => void;
} = {}): Promise<SatelliteManifest> {
  const base = publicSatelliteBase();
  const saved = options.forceFresh ? null : restored(base);
  if (!saved) return refresh(base);
  void refresh(base).then(fresh => {
    if (JSON.stringify(fresh.frames) !== JSON.stringify(saved.frames)) options.onUpdated?.(fresh);
  }).catch(() => { /* A valid saved observation remains usable until its age limit. */ });
  return saved;
}
