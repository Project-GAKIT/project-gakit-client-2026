import { describe, expect, it, vi } from 'vitest';
import { fetchForecastRainfall, fetchForecastWeather, forecastRasterUrl, sampleForecast, validateForecastWeather } from '@/lib/map/forecastWeather';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import type { ForecastWeather } from '@/types/forecastWeather';

const fixture = (): ForecastWeather => ({
  model: 'ecmwf_ifs', source: 'ECMWF IFS Open Data', issuedAt: '2026-11-06T00:00:00Z', rainResolutionDegrees: .1, nativeIntervalHours: 3,
  fetchedAt: '2026-11-06T00:00:00Z', expiresAt: '2026-11-06T12:00:00Z', stale: false,
  bounds: { west: 120, east: 122, south: 6, north: 8 }, rows: 2, cols: 2,
  latitude: [7.5, 6.5], longitude: [120.5, 121.5], sampleSpacingDegrees: 1,
  times: ['2026-11-06T00:00:00Z', '2026-11-06T01:00:00Z'],
  frames: [0, 1].map(() => ({ u: [0, 10, 20, 30], v: [-1, -1, -1, -1], rasterUrl: '/api/v1/weather/forecast-grid/assets/' + 'a'.repeat(24) + '/3.png', rainWindowEndAt: '2026-11-06T03:00:00Z' })),
  rainUnit: 'mm', windUnit: 'm/s',
});

describe('combined forecast rain and wind', () => {
  it.each(['png', 'webp'])('uses the single published %s frame for CDN and API reads', format => {
    const grid = fixture();
    grid.frames[0].rasterUrl = '/api/v1/weather/forecast-grid/assets/' + 'a'.repeat(24) + '/3.' + format;
    expect(validateForecastWeather(grid)).toBe(grid);
    grid.publicationBase = 'https://storage.test/weather-maps/forecast';
    expect(forecastRasterUrl(grid, grid.frames[0])).toBe(grid.publicationBase + '/rasters/' + 'a'.repeat(24) + '/3.' + format);
  });

  it('interpolates components and retains dry, missing and out-of-coverage distinctions', () => {
    const data = fixture();
    expect(sampleForecast(data, data.frames[0].u, 121, 7)).toBe(15);
    expect(sampleForecast(data, data.frames[0].u, 120.5, 7.5)).toBe(0);
    expect(sampleForecast(data, data.frames[0].u, 119, 7)).toBeNull();
    data.frames[0].u[3] = null;
    expect(sampleForecast(data, data.frames[0].u, 121, 7)).toBeNull();
    expect(sampleForecast(data, data.frames[0].u, 120.5, 7.5)).toBe(0);
  });

  it('rejects incomplete grids, time misalignment and unexpected units', () => {
    expect(validateForecastWeather(fixture()).model).toBe('ecmwf_ifs');
    const shape = fixture(); shape.frames[0].u.pop();
    expect(() => validateForecastWeather(shape)).toThrow();
    const time = fixture(); time.times[1] = time.times[0];
    expect(() => validateForecastWeather(time)).toThrow();
    const invalid = fixture(); invalid.frames[0].u[0] = NaN;
    expect(() => validateForecastWeather(invalid)).toThrow();
    expect(() => validateForecastWeather({ ...fixture(), windUnit: 'km/h' })).toThrow();
    expect(() => validateForecastWeather({ ...fixture(), rainResolutionDegrees: 1.25 })).toThrow();
    const native = fixture(); native.rainResolutionDegrees = .1; native.issuedAt = native.fetchedAt;
    native.frames.forEach(frame => { frame.rasterUrl = '/api/v1/weather/forecast-grid/assets/' + 'a'.repeat(24) + '/3.png'; });
    expect(validateForecastWeather(native).rainResolutionDegrees).toBe(.1);
  });

  it('deduplicates rainfall and wind requests and reuses frames while scrubbing', async () => {
    invalidateApiCache('/api/v1/weather/forecast-grid');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture()), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    try {
      const [rain, wind] = await Promise.all([fetchForecastWeather(), fetchForecastWeather()]);
      expect(rain).toBe(wind);
      await fetchForecastWeather();
      expect(fetcher).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); invalidateApiCache('/api/v1/weather/forecast-grid'); }
  });
});

it('preloads and deduplicates the exact forecast numeric frame for local hover', async () => {
  const grid = fixture(); grid.rainNumeric = true;
  const bytes = new Uint8Array(16); const view = new DataView(bytes.buffer);
  [0, 12.4, NaN, 0.04].forEach((v, i) => view.setFloat32(i * 4, v, true));
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    encoding: 'float32-le', source: 'ECMWF', accumulationHours: 1,
    latitude: [8.25, 8.15], longitude: [124.25, 124.35],
    values: btoa(String.fromCharCode(...bytes)),
  })));
  vi.stubGlobal('fetch', fetcher);
  try {
    const [first, second] = await Promise.all([fetchForecastRainfall(grid, grid.frames[0]), fetchForecastRainfall(grid, grid.frames[1])]);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toContain('/3.json.gz');
    expect(first).toBe(second);
    expect(first?.values[1]).toBeCloseTo(12.4);
    expect(first?.observedAt).toBe(grid.frames[0].rainWindowEndAt);
    expect(first?.values[0]).toBe(0);
    expect(Number.isNaN(first?.values[2])).toBe(true);
  } finally { vi.unstubAllGlobals(); }
});

it('bounds in-flight forecast downloads and keeps a replacement cache entry after an older request aborts', async () => {
  const grid = fixture(); grid.rainNumeric = true;
  const signals: AbortSignal[] = [];
  const fetcher = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
    const signal = options.signal!;
    signals.push(signal);
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  }));
  vi.stubGlobal('fetch', fetcher);
  const requests: Promise<unknown>[] = [];
  const frame = (index: number) => ({ ...grid.frames[0], rasterUrl: '/api/v1/weather/forecast-grid/assets/' + 'b'.repeat(24) + '/' + index + '.webp' });
  try {
    for (let i = 0; i < 10; i++) requests.push(fetchForecastRainfall(grid, frame(i))!.catch(() => null));
    expect(signals.filter(signal => !signal.aborted).length).toBeLessThanOrEqual(8);
    requests.push(fetchForecastRainfall(grid, frame(0))!.catch(() => null));
    await Promise.resolve(); await Promise.resolve();
    const count = fetcher.mock.calls.length;
    requests.push(fetchForecastRainfall(grid, frame(0))!.catch(() => null));
    expect(fetcher).toHaveBeenCalledTimes(count);
  } finally {
    // Finish pending mocks so no aborted download can leak into the next test.
    for (const signal of signals) if (!signal.aborted) signal.dispatchEvent(new Event('abort'));
    await Promise.all(requests);
    vi.unstubAllGlobals();
  }
});
