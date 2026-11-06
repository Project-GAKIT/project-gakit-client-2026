import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchRainfallImage } from '@/lib/map/rainfall';
import { fetchHeatIndex } from '@/lib/map/heatIndex';
import { decodeBrowserForecast, fetchForecastWeather, forecastRasterUrl } from '@/lib/map/forecastWeather';
import { publishedWeatherJSON } from '@/lib/map/weatherPublication';

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://weather.test');
  invalidateApiCache('');
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); invalidateApiCache(''); });

describe('direct shared weather publications', () => {
  it('loads one JAXA manifest for multiple accumulation windows without GeoJSON', async () => {
    const frame = { observedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), source: 'JAXA GSMaP_NOW', accumulationHours: 1, rasterPath: 'rainfall/rasters/' + 'a'.repeat(64) + '.webp' };
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ schema: 'jaxa-maps-v1', resolutionDegrees: .1, bounds: { north: 29.2, east: 150, south: -.2, west: 105 }, windows: { 1: frame, 4: { ...frame, accumulationHours: 4 } } })));
    vi.stubGlobal('fetch', fetcher);
    const [one, four] = await Promise.all([fetchRainfallImage(1), fetchRainfallImage(4)]);
    expect(one.url).toBe('https://weather.test/storage/v1/object/public/weather-maps/' + frame.rasterPath);
    expect(four.url).toBe(one.url);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/weather-maps/rainfall/latest.json');
  });

  it('rejects expired JAXA publications and preserves the API fallback', async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('latest.json')
      ? { schema: 'jaxa-maps-v1', windows: {} }
      : { type: 'FeatureCollection', features: [], properties: { observedAt: new Date().toISOString(), source: 'JAXA GSMaP_NOW' } })));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchRainfallImage(1)).source).toBe('JAXA GSMaP_NOW');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain('/api/v1/rainfall/gsmap?hours=1');
  });

  it('reuses one heat snapshot across forecast selections', async () => {
    const now = Math.floor(Date.now() / 3_600_000) * 3_600_000;
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ version: 1, fetched_at: new Date().toISOString(),
      times: Array.from({ length: 25 }, (_, h) => new Date(now + h * 3_600_000).toISOString()), frames: Array.from({ length: 25 }, (_, h) => Array(250).fill(30 + h)),
      bounds: { west: 116.5, east: 127, south: 4.5, north: 21.5 }, rows: 25, cols: 10, latitude: Array.from({ length: 25 }, (_, i) => 21 - i * .6), longitude: Array.from({ length: 10 }, (_, i) => 117 + i),
    })));
    vi.stubGlobal('fetch', fetcher);
    expect((await fetchHeatIndex(0)).values[0]).toBe(30);
    expect((await fetchHeatIndex(24)).values[0]).toBe(54);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bounds retries when a shared publication is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(publishedWeatherJSON('rainfall/latest.json')).rejects.toThrow();
    await expect(publishedWeatherJSON('rainfall/latest.json')).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

function packedFixture() {
  const start = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const bytes = new Uint8Array(32), view = new DataView(bytes.buffer);
  [123, -32768, 0, -500, 456, 0, -32768, 200, -123, 327, 1, -1, 0, -1, 1, 0].forEach((n, i) => view.setInt16(i * 2, n, true));
  return { schema: 'forecast-browser-v1', model: 'ecmwf_ifs', source: 'ECMWF IFS Open Data', rainUnit: 'mm', windUnit: 'm/s',
    rows: 2, cols: 2, latitude: [7.5, 6.5], longitude: [120.5, 121.5], bounds: { west: 120, east: 122, south: 6, north: 8 }, sampleSpacingDegrees: 1,
    fetchedAt: new Date().toISOString(), issuedAt: new Date(start).toISOString(), expiresAt: new Date(start + 12 * 3_600_000).toISOString(), stale: false,
    rainResolutionDegrees: .1, nativeIntervalHours: 3, times: [start, start + 3_600_000].map(n => new Date(n).toISOString()),
    frames: [0, 1].map(() => ({ rasterUrl: '/api/v1/weather/forecast-grid/assets/' + 'a'.repeat(24) + '/3.png', rainWindowEndAt: new Date(start + 3 * 3_600_000).toISOString() })),
    windEncoding: 'int16-le-base64', windScale: .01, windPacked: btoa(String.fromCharCode(...bytes)), windAnchors: [0, 1], windOverrides: [] as [number, number][],
  };
}

describe('compact rain and wind manifest', () => {
  it('retains component precision and missing values while decoding selected frames', () => {
    const data = decodeBrowserForecast(packedFixture());
    expect(data.frames[0].u).toEqual([1.23, null, 0, -5]);
    expect(data.frames[0].v).toEqual([4.56, 0, null, 2]);
    expect(data.frames[1].u).toEqual([-1.23, 3.27, .01, -.01]);
    expect('rain' in data.frames[0]).toBe(false);
    expect(() => decodeBrowserForecast({ ...packedFixture(), windPacked: 'AAAA' })).toThrow();
    expect(() => decodeBrowserForecast({ ...packedFixture(), windScale: 1 })).toThrow();
  });

  it('uses one storage request for rain and wind, with direct immutable raster URLs', async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify(packedFixture())));
    vi.stubGlobal('fetch', fetcher);
    const [rain, wind] = await Promise.all([fetchForecastWeather(), fetchForecastWeather()]);
    expect(rain).toBe(wind);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0][0])).toContain('/weather-maps/forecast/browser.json');
    expect(forecastRasterUrl(rain, rain.frames[0])).toBe('https://weather.test/storage/v1/object/public/weather-maps/forecast/rasters/' + 'a'.repeat(24) + '/3.png');
  });

  it('interpolates native time anchors while preserving explicit missing-data overrides', () => {
    const data = packedFixture();
    const start = Date.parse(data.times[0]);
    data.times = [0, 1, 2].map(h => new Date(start + h * 3_600_000).toISOString());
    data.frames.push({ ...data.frames[0] });
    data.windAnchors = [0, 2];
    data.windOverrides = [[9, 200]];
    const decoded = decodeBrowserForecast(data);
    expect(decoded.frames[1].u[0]).toBe(0);
    expect(decoded.frames[1].u[1]).toBe(2);
    expect(decoded.frames[1].v[2]).toBeNull();
  });
});
