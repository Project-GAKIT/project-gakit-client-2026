import { cachedGet } from '@/lib/backend/apiCache';
import type { ForecastWeather, ForecastWeatherFrame } from '@/types/forecastWeather';
import { publishedWeatherJSON, publicWeatherBase } from '@/lib/map/weatherPublication';

export type RainfallMode = 'recent' | 'forecast';

export function validateForecastWeather(value: unknown): ForecastWeather {
  const data = value as ForecastWeather;
  if (!data || data.model !== 'ecmwf_ifs' || data.rainUnit !== 'mm' || data.windUnit !== 'm/s'
    || !Number.isInteger(data.rows) || !Number.isInteger(data.cols) || data.rows < 2 || data.cols < 2
    || data.rows * data.cols > 2000 || !Array.isArray(data.times) || data.times.length < 2 || data.times.length > 100
    || !Array.isArray(data.frames) || data.frames.length !== data.times.length
    || data.latitude?.length !== data.rows || data.longitude?.length !== data.cols
    || !Number.isFinite(Date.parse(data.fetchedAt)) || !Number.isFinite(Date.parse(data.expiresAt))) {
    throw new Error('Forecast rainfall and wind are unavailable.');
  }
  const valid = (v: number | null) => v === null || (typeof v === 'number' && Number.isFinite(v));
  if (!data.bounds || ![data.bounds.west, data.bounds.east, data.bounds.south, data.bounds.north].every(Number.isFinite)
    || data.bounds.west >= data.bounds.east || data.bounds.south >= data.bounds.north
    || !data.latitude.every((v, i, a) => Number.isFinite(v) && (!i || v < a[i - 1]))
    || !data.longitude.every((v, i, a) => Number.isFinite(v) && (!i || v > a[i - 1]))
    || !data.times.every((t, i, a) => Number.isFinite(Date.parse(t)) && (!i || Date.parse(t) - Date.parse(a[i - 1]) === 3_600_000))
    || data.rainResolutionDegrees !== .1 || data.nativeIntervalHours !== 3 || !Number.isFinite(Date.parse(data.issuedAt))
    || !data.frames.every(f => [f.u, f.v].every(a => Array.isArray(a) && a.length === data.rows * data.cols && a.every(valid))
      && Number.isFinite(Date.parse(f.rainWindowEndAt))
      && /^\/api\/v1\/weather\/forecast-grid\/assets\/[a-f0-9]{24}\/\d{1,3}\.(?:png|webp)$/.test(f.rasterUrl))) throw new Error('Forecast data is incomplete.');
  data.frames = data.frames.map(({ u, v, rasterUrl, rainWindowEndAt }) => ({ u, v, rasterUrl, rainWindowEndAt }));
  return data;
}

export function fetchForecastWeather(): Promise<ForecastWeather> {
  return cachedGet('/api/v1/weather/forecast-grid:regional-v3', 5 * 60_000, async () => {
    if (publicWeatherBase()) {
      try {
        const value = await publishedWeatherJSON<unknown>('forecast/browser.json', 'weather-maps', 1_000_000);
        const data = decodeBrowserForecast(value);
        if (Date.parse(data.expiresAt) <= Date.now()) throw new Error('Published forecast has expired');
        data.publicationBase = `${publicWeatherBase()}/forecast`;
        return data;
      } catch { /* The API remains a cold-storage/provider-outage fallback. */ }
    }
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/weather/forecast-grid`, { cache: 'no-cache', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Forecast rainfall and wind are temporarily unavailable.');
    return validateForecastWeather(await response.json());
  });
}

export function forecastRasterUrl(grid: ForecastWeather, frame: ForecastWeatherFrame): string | null {
  if (!frame.rasterUrl) return null;
  const match = frame.rasterUrl.match(/\/assets\/([a-f0-9]{24})\/(\d{1,3}\.(?:png|webp))$/);
  if (grid.publicationBase && match) return `${grid.publicationBase}/rasters/${match[1]}/${match[2]}`;
  return `${process.env.NEXT_PUBLIC_API_URL ?? ''}${frame.rasterUrl}`;
}

export function decodeBrowserForecast(value: unknown): ForecastWeather {
  const data = value as ForecastWeather & { schema: string; windEncoding: string; windScale: number; windPacked: string; windAnchors: number[]; windOverrides: [number, number][] };
  if (!data || data.schema !== 'forecast-browser-v1' || data.windEncoding !== 'int16-le-base64' || data.windScale !== .01
    || !Number.isInteger(data.rows) || !Number.isInteger(data.cols) || data.rows < 2 || data.cols < 2 || data.rows * data.cols > 2000
    || !Array.isArray(data.frames) || data.frames.length < 2 || data.frames.length > 100 || typeof data.windPacked !== 'string'
    || !Array.isArray(data.windAnchors) || data.windAnchors[0] !== 0 || data.windAnchors.at(-1) !== data.frames.length - 1
    || !data.windAnchors.every((n, i, a) => Number.isInteger(n) && n >= 0 && (!i || n > a[i - 1] && n - a[i - 1] <= 3))) throw new Error('Invalid published forecast');
  const size = data.rows * data.cols;
  const encoded = atob(data.windPacked);
  if (encoded.length !== size * data.windAnchors.length * 4) throw new Error('Incomplete wind field');
  if (!Array.isArray(data.windOverrides) || data.windOverrides.length > size * data.frames.length * 2
    || !data.windOverrides.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isInteger)
      && pair[0] >= 0 && pair[0] < size * data.frames.length * 2 && pair[1] >= -32768 && pair[1] <= 32767)) throw new Error('Invalid missing-data overrides');
  const overrides = new Map(data.windOverrides);
  const anchors = data.windAnchors;
  const bytes = Uint8Array.from(encoded, c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const emptyVectors: null[] = Array(size).fill(null);
  // Validate metadata with shared shape checks without decoding every wind frame.
  const shells = data.frames.map(frame => ({ ...frame, u: emptyVectors, v: emptyVectors }));
  const result = validateForecastWeather({ ...data, frames: shells });
  const decoded = new Map<number, { u: (number | null)[]; v: (number | null)[] }>();
  const vectors = (index: number) => {
    const existing = decoded.get(index);
    if (existing) return existing;
    const high = anchors.findIndex(n => n >= index), low = anchors[high] === index ? high : high - 1;
    const mix = low === high ? 0 : (index - anchors[low]) / (anchors[high] - anchors[low]);
    const read = (component: number) => Array.from({ length: size }, (_, cell) => {
      const override = overrides.get((index * 2 + component) * size + cell);
      if (override !== undefined) return override === -32768 ? null : override / 100;
      const before = view.getInt16(((low * 2 + component) * size + cell) * 2, true);
      const after = view.getInt16(((high * 2 + component) * size + cell) * 2, true);
      return before === -32768 || after === -32768 ? null : Math.round(before * (1 - mix) + after * mix) / 100;
    });
    const frame = { u: read(0), v: read(1) };
    decoded.set(index, frame);
    if (decoded.size > 4) decoded.delete(decoded.keys().next().value!);
    return frame;
  };
  result.frames = shells.map((frame, index) => Object.defineProperties(frame, {
    u: { get: () => vectors(index).u }, v: { get: () => vectors(index).v },
  }));
  // Do not retain a second copy of the base64 string after decoding its bytes.
  delete (result as Partial<typeof data>).windPacked;
  return result;
}

/** Bilinear interpolation in component space, never across missing evidence. */
export function sampleForecast(grid: ForecastWeather, values: (number | null)[], lng: number, lat: number): number | null {
  const b = grid.bounds;
  if (lng < b.west || lng > b.east || lat < b.south || lat > b.north) return null;
  const x = Math.max(0, Math.min(grid.cols - 1, (lng - grid.longitude[0]) / (grid.longitude[1] - grid.longitude[0])));
  const y = Math.max(0, Math.min(grid.rows - 1, (grid.latitude[0] - lat) / (grid.latitude[0] - grid.latitude[1])));
  const col = Math.min(grid.cols - 2, Math.floor(x)), row = Math.min(grid.rows - 2, Math.floor(y));
  const tx = x - col, ty = y - row;
  const indices = [row * grid.cols + col, row * grid.cols + col + 1, (row + 1) * grid.cols + col, (row + 1) * grid.cols + col + 1];
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  let total = 0;
  for (let i = 0; i < 4; i++) {
    if (weights[i] < 1e-9) continue;
    const value = values[indices[i]];
    if (value == null || !Number.isFinite(value)) return null;
    total += value * weights[i];
  }
  return total;
}

export function forecastCoordinates(grid: ForecastWeather): [number, number][] {
  const { west, east, south, north } = grid.bounds;
  return [[west, north], [east, north], [east, south], [west, south]];
}

export function forecastTime(time: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(time)) + ' PHT';
}
