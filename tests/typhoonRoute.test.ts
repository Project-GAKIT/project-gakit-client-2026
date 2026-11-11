import { beforeEach, describe, expect, it, vi } from 'vitest';

const panahon = vi.hoisted(() => ({ fetchPanahonLiveCyclone: vi.fn() }));
vi.mock('@/lib/map/panahon', () => panahon);

const serverPayload = {
  track: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [125.0, 15.0] },
        properties: {
          datetime: '2026-11-10T08:00:00',
          typhoon_name: 'PRE-SAMUEL (CEMPAKA)',
          typhoon_type: 'TY',
        },
      },
    ],
  },
  par: null,
  hasActiveTyphoon: true,
  isHistorical: false,
  stormName: 'PRE-SAMUEL (CEMPAKA)',
  stormCategory: 'TY',
  activeStorms: [{ name: 'PRE-SAMUEL (CEMPAKA)' }],
  latestPosition: null,
  fetchedAt: '2026-11-10T08:00:00Z',
  source: 'DOST-PAGASA PANAHON',
};

const liveRequest = () => new Request('https://gakit.test/api/typhoon-track');

describe('typhoon track live fallback', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    panahon.fetchPanahonLiveCyclone.mockResolvedValue(null);
  });

  it('keeps the last live storm when the backend and Panahon feed both fail', async () => {
    const globalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => serverPayload,
      }) as unknown as typeof fetch;

      const { GET } = await import('@/app/api/typhoon-track/route');
      const first = await (await GET(liveRequest())).json();
      expect(first.hasActiveTyphoon).toBe(true);

      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error('backend offline')) as unknown as typeof fetch;
      const second = await (await GET(liveRequest())).json();

      expect(second.hasActiveTyphoon).toBe(true);
      expect(second.stormName).toBe('PRE-SAMUEL (CEMPAKA)');
      expect(panahon.fetchPanahonLiveCyclone).toHaveBeenCalled();
    } finally {
      globalThis.fetch = globalFetch;
    }
  });

  it('clears the cache when a healthy backend reports no active storm', async () => {
    const globalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => serverPayload,
      }) as unknown as typeof fetch;

      const { GET } = await import('@/app/api/typhoon-track/route');
      await GET(liveRequest());

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...serverPayload,
          hasActiveTyphoon: false,
          stormName: null,
          track: { type: 'FeatureCollection', features: [] },
        }),
      }) as unknown as typeof fetch;

      const result = await (await GET(liveRequest())).json();
      expect(result.hasActiveTyphoon).toBe(false);
    } finally {
      globalThis.fetch = globalFetch;
    }
  });
});
