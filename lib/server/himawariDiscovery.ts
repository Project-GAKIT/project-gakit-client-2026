import { SATELLITE_RETENTION_MS, scanEpoch } from '@/lib/map/himawariPublication';

export const MAX_FRAME_AGE_MS = SATELLITE_RETENTION_MS;
const TIMEOUT_MS = 8_000;
const BACKOFF_MS = [1_000, 2_000];

export class SatelliteDiscoveryError extends Error {
  constructor(
    readonly kind: 'http' | 'network' | 'timeout' | 'invalid_metadata' | 'stale',
    message: string,
    readonly details: { status?: number; latestScan?: string; attempts?: number } = {},
  ) { super(message); this.name = 'SatelliteDiscoveryError'; }
}

/** Only completed, valid observations inside the common freshness limit. */
export function selectAvailableStamps(stamps: unknown[], now = Date.now()): number[] {
  return [...new Set(stamps.filter((stamp): stamp is number => {
    if (typeof stamp !== 'number') return false;
    const epoch = scanEpoch(String(stamp));
    return Number.isFinite(epoch) && epoch <= now && now - epoch <= MAX_FRAME_AGE_MS;
  }))].sort((a, b) => b - a);
}

/** Retry transport/server failures; stale data and rate limits wait for the next poll. */
export async function fetchHimawariMetadata(url: string): Promise<number[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) throw new SatelliteDiscoveryError('http', `CIRA metadata returned HTTP ${response.status}`, { status: response.status });
      let body: { timestamps_int?: unknown } | null;
      try { body = await response.json(); }
      catch (cause) {
        if (cause instanceof SyntaxError) throw new SatelliteDiscoveryError('invalid_metadata', 'CIRA metadata is not valid JSON');
        throw cause;
      }
      if (!body || !Array.isArray(body.timestamps_int)) throw new SatelliteDiscoveryError('invalid_metadata', 'CIRA metadata has no timestamp list');
      const now = Date.now();
      const stamps = selectAvailableStamps(body.timestamps_int, now);
      if (!stamps.length) {
        const lastCompleted = body.timestamps_int.filter((s): s is number => typeof s === 'number'
          && Number.isFinite(scanEpoch(String(s))) && scanEpoch(String(s)) <= now).sort((a, b) => b - a)[0];
        if (lastCompleted === undefined) throw new SatelliteDiscoveryError('invalid_metadata', 'CIRA metadata has no valid completed scan timestamps');
        const age = Math.floor((now - scanEpoch(String(lastCompleted))) / 60_000);
        throw new SatelliteDiscoveryError('stale', `Latest CIRA scan ${lastCompleted} is ${age} minutes old; freshness limit is ${MAX_FRAME_AGE_MS / 60_000} minutes`, { latestScan: String(lastCompleted) });
      }
      return stamps;
    } catch (cause) {
      const error = cause instanceof SatelliteDiscoveryError ? cause : new SatelliteDiscoveryError(
        cause instanceof Error && ['TimeoutError', 'AbortError'].includes(cause.name) ? 'timeout' : 'network',
        cause instanceof Error ? `${cause.name}: ${cause.message.slice(0, 200)}` : 'CIRA metadata request failed',
      );
      error.details.attempts = attempt + 1;
      const retryable = error.kind === 'network' || error.kind === 'timeout'
        || error.kind === 'http' && (error.details.status === 408 || (error.details.status ?? 0) >= 500);
      if (!retryable || attempt >= BACKOFF_MS.length) throw error;
      await new Promise(resolve => setTimeout(resolve, BACKOFF_MS[attempt]));
    }
  }
}
