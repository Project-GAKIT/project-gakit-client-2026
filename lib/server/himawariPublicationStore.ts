import { createClient } from '@supabase/supabase-js';
import { SATELLITE_BUCKET, SATELLITE_PREFIX, satelliteObjectPath, parseSatelliteManifest,
  type SatelliteManifest } from '@/lib/map/himawariPublication';
import type { SatellitePublicationStore } from './himawariPublisher';

/** Worker-only adapter. The public reader never needs this credential. */
export function createSatellitePublicationStore(url: string, serviceKey: string): SatellitePublicationStore & { ensureBucket(): Promise<void> } {
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000) }) } });
  const bucket = client.storage.from(SATELLITE_BUCKET);
  const manifestPath = `${SATELLITE_PREFIX}/latest.json`;
  return {
    async ensureBucket() {
      const { data, error } = await client.storage.getBucket(SATELLITE_BUCKET);
      if (error) {
        if (!['404', '400'].includes(String((error as { status?: number }).status))
          || !/not found|does not exist|no.?such.?bucket/i.test(error.message)) throw error;
        const result = await client.storage.createBucket(SATELLITE_BUCKET, { public: true,
          allowedMimeTypes: ['image/png', 'application/json'], fileSizeLimit: 8_000_000 });
        if (result.error) throw result.error;
      } else if (!data.public) throw new Error('Satellite bucket exists but is private; refusing to change it');
    },
    async readManifest() {
      const { data, error } = await bucket.download(manifestPath, {}, { cache: 'no-store' });
      if (error) {
        if (/not found|does not exist|no.?such.?key/i.test(error.message)) return null;
        throw error;
      }
      return parseSatelliteManifest(JSON.parse(await data.text()));
    },
    async listFrames() {
      const stamps: string[] = [];
      for (let offset = 0; ; offset += 100) {
        const { data, error } = await bucket.list(`${SATELLITE_PREFIX}/frames`, {
          limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
        if (error) throw error;
        for (const f of data) if (/^\d{14}\.png$/.test(f.name)) stamps.push(f.name.slice(0, 14));
        if (data.length < 100) return stamps;
      }
    },
    async readFrame(stamp) {
      const { data, error } = await bucket.download(satelliteObjectPath(stamp));
      if (error) throw error;
      return Buffer.from(await data.arrayBuffer());
    },
    async uploadFrame(stamp, png) {
      const { error } = await bucket.upload(satelliteObjectPath(stamp), png, {
        contentType: 'image/png', cacheControl: '86400', upsert: false });
      if (error) throw error;
    },
    async publish(manifest: SatelliteManifest) {
      const { error } = await bucket.upload(manifestPath, JSON.stringify(manifest), {
        contentType: 'application/json', cacheControl: '0', upsert: true });
      if (error) throw error;
    },
    async removeFrames(stamps) {
      for (let i = 0; i < stamps.length; i += 100) {
        const { error } = await bucket.remove(stamps.slice(i, i + 100).map(satelliteObjectPath));
        if (error) throw error;
      }
    },
  };
}
