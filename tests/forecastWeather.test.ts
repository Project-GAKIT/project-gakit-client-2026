import { describe, expect, it, vi } from 'vitest';
import { fetchForecastWeather, sampleForecast, validateForecastWeather } from '@/lib/map/forecastWeather';
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
