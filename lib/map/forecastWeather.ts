import { cachedGet } from '@/lib/backend/apiCache';
import { RAINFALL_BAND_EDGES } from '@/lib/map/colorScales';
import type { ForecastWeather, ForecastWeatherFrame } from '@/types/forecastWeather';

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
    || (data.rainResolutionDegrees === .1 && (!data.issuedAt || !Number.isFinite(Date.parse(data.issuedAt)) || !data.frames.every(f => Boolean(f.rasterUrl))))
    || !data.frames.every(f => [f.rain, f.u, f.v].every(a => Array.isArray(a) && a.length === data.rows * data.cols && a.every(valid))
      && f.rain.every(v => v === null || v >= 0)
      && (!f.rasterUrl || /^\/api\/v1\/weather\/forecast-grid\/assets\/[a-f0-9]{24}\/\d{1,3}\.png$/.test(f.rasterUrl)))) throw new Error('Forecast data is incomplete.');
  return data;
}

export function fetchForecastWeather(): Promise<ForecastWeather> {
  return cachedGet('/api/v1/weather/forecast-grid:regional-v3', 5 * 60_000, async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/weather/forecast-grid`, { cache: 'no-cache', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Forecast rainfall and wind are temporarily unavailable.');
    return validateForecastWeather(await response.json());
  });
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

const COLORS = [[0, 0, 150], [0, 100, 255], [0, 180, 255], [51, 219, 128], [155, 235, 74], [255, 235, 0], [255, 179, 0], [255, 100, 0], [235, 30, 0], [175, 0, 0]];

/** Small raster generated only on frame changes, not during wind animation. */
export function forecastRainfallImage(grid: ForecastWeather, frame: ForecastWeatherFrame): string | null {
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * 4;
  canvas.height = grid.rows * 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height), edges = RAINFALL_BAND_EDGES[1], b = grid.bounds;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const rain = sampleForecast(grid, frame.rain, b.west + (x + .5) / canvas.width * (b.east - b.west), b.north - (y + .5) / canvas.height * (b.north - b.south));
      if (rain == null || rain < edges[0]) continue;
      let band = edges.length - 1;
      for (let i = 0; i < edges.length - 1; i++) if (rain < edges[i + 1]) { band = i; break; }
      const next = Math.min(COLORS.length - 1, band + 1);
      const t = next === band ? 0 : (rain - edges[band]) / (edges[next] - edges[band]);
      const offset = (y * canvas.width + x) * 4;
      for (let c = 0; c < 3; c++) image.data[offset + c] = Math.round(COLORS[band][c] * (1 - t) + COLORS[next][c] * t);
      image.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function forecastCoordinates(grid: ForecastWeather): [number, number][] {
  const { west, east, south, north } = grid.bounds;
  return [[west, north], [east, north], [east, south], [west, south]];
}

export function forecastTime(time: string): string {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(time)) + ' PHT';
}
