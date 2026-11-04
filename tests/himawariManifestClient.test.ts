import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const base = 'https://project.supabase.co/storage/v1/object/public/satellite-frames';
const key = `gakit:satellite-manifest:v2:${base}`;
const manifest = (stamps = ['20261104065000']) => ({ schema: 'himawari-publication-v2',
  generated_at: '2026-11-04T07:00:00Z', frames: stamps.map(stamp => ({ stamp, bytes: 400000, sha256: 'a'.repeat(64) })) });
let saved: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-04T07:00:00Z'));
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co'); saved = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => saved.set(k, v), removeItem: (k: string) => saved.delete(k) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('direct satellite manifest and saved observations', () => {
  it('uses only public CDN reads, validates and persists successful responses', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json(manifest())); vi.stubGlobal('fetch', fetcher);
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    expect(await loadSatelliteManifest()).toEqual(manifest());
    expect(fetcher.mock.calls[0][0]).toContain(base + '/himawari-v2/latest.json?t=');
    expect(saved.get(key)).toBe(JSON.stringify(manifest()));
  });
  it('returns a saved observation before a stalled refresh and notifies when newer scans arrive', async () => {
    saved.set(key, JSON.stringify(manifest()));
    let resolve!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(r => { resolve = r; })));
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    const updated = vi.fn();
    expect(await loadSatelliteManifest({ onUpdated: updated })).toEqual(manifest());
    expect(updated).not.toHaveBeenCalled();
    resolve(Response.json(manifest(['20261104065000', '20261104070000'])));
    await vi.waitFor(() => expect(updated).toHaveBeenCalledOnce());
    expect(JSON.parse(saved.get(key)!).frames).toHaveLength(2);
  });
  it('keeps a valid saved observation usable through a refresh outage', async () => {
    saved.set(key, JSON.stringify(manifest())); vi.stubGlobal('fetch', vi.fn(async () => { throw Error('offline'); }));
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    expect(await loadSatelliteManifest()).toEqual(manifest());
    await Promise.resolve(); expect(saved.has(key)).toBe(true);
  });
  it.each(['{bad json', JSON.stringify(manifest(['20261104030000'])),
    JSON.stringify(manifest(['20261104071000']))])('ignores corrupt, expired or future saved observations', async value => {
    saved.set(key, value); vi.stubGlobal('fetch', vi.fn(async () => Response.json(manifest())));
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    expect(await loadSatelliteManifest()).toEqual(manifest());
  });
  it('continues without persistence when browser storage is blocked', async () => {
    vi.stubGlobal('localStorage', { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() {} });
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(manifest())));
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    expect(await loadSatelliteManifest()).toEqual(manifest());
  });
  it('shares concurrent refreshes and lets an explicit retry bypass saved data', async () => {
    saved.set(key, JSON.stringify(manifest()));
    let resolve!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; })); vi.stubGlobal('fetch', fetcher);
    const { loadSatelliteManifest } = await import('@/lib/map/himawariManifestClient');
    const a = loadSatelliteManifest({ forceFresh: true }), b = loadSatelliteManifest({ forceFresh: true });
    expect(fetcher).toHaveBeenCalledOnce(); resolve(Response.json(manifest(['20261104070000'])));
    expect(await a).toEqual(await b); expect((await a).frames[0].stamp).toBe('20261104070000');
  });
});
