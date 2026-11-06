import { weatherTimestamp } from './weatherTime';
import { cachedGet } from '@/lib/backend/apiCache';
import { fetchRainfallImage, RAINFALL_BOUNDS, renderRainfallMatrix, type RainfallAccumulationHours } from './rainfall';

export interface RainfallNumeric {
  observedAt: string;
  source: string;
  accumulationHours: number;
  latitude: number[];
  longitude: number[];
  values: Float32Array;
}

export function decodeRainfallNumeric(value: unknown): RainfallNumeric {
  const data = value as Omit<RainfallNumeric, 'values'> & { encoding: string; values: string };
  const axis = (values: number[]) => Array.isArray(values) && values.length >= 2 && values.every((v, i) => Number.isFinite(v)
    && (!i || Math.abs(Math.abs(v - values[i - 1]) - 0.1) < 0.00001)
    && (i < 2 || Math.sign(v - values[i - 1]) === Math.sign(values[1] - values[0])));
  if (!data || data.encoding !== 'float32-le' || !axis(data.latitude) || !axis(data.longitude)
    || data.latitude.length * data.longitude.length > 200_000 || typeof data.values !== 'string'
    || data.values.length > 1_100_000 || !Number.isFinite(Date.parse(data.observedAt))) throw new Error('Invalid rainfall grid');
  const binary = atob(data.values);
  const size = data.latitude.length * data.longitude.length;
  if (binary.length !== size * 4) throw new Error('Incomplete rainfall grid');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  const values = new Float32Array(size);
  for (let i = 0; i < size; i++) values[i] = view.getFloat32(i * 4, true);
  const observedAt = weatherTimestamp(data.observedAt);
  if (!observedAt) throw new Error('Invalid rainfall timestamp');
  return { ...data, observedAt, values };
}

export function fetchRainfallNumeric(hours: RainfallAccumulationHours): Promise<RainfallNumeric> {
  return cachedGet(`/api/v1/rainfall/gsmap/numeric?hours=${hours}`, 60_000, async () => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/v1/rainfall/gsmap/numeric?hours=${hours}`, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error('Numeric rainfall is unavailable');
    const grid = decodeRainfallNumeric(await response.json());
    if (grid.accumulationHours !== hours) throw new Error('Incorrect rainfall window');
    return grid;
  });
}

export function sampleRainfallNumeric(grid: RainfallNumeric, lng: number, lat: number): number | null {
  const row = Math.round((lat - grid.latitude[0]) / (grid.latitude[1] - grid.latitude[0]));
  const col = Math.round((lng - grid.longitude[0]) / (grid.longitude[1] - grid.longitude[0]));
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || col < 0 || row >= grid.latitude.length || col >= grid.longitude.length) return null;
  const value = grid.values[row * grid.longitude.length + col];
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const rendered = new WeakMap<RainfallNumeric, string>();

/** Render exactly the same snapshot that supplies hover values. */
export function renderNumericRainfall(grid: RainfallNumeric): string | null {
  const existing = rendered.get(grid);
  if (existing) return existing;
  const cols = Math.round((RAINFALL_BOUNDS.east - RAINFALL_BOUNDS.west) / 0.1);
  const rows = Math.round((RAINFALL_BOUNDS.north - RAINFALL_BOUNDS.south) / 0.1);
  const matrix = new Float32Array(rows * cols).fill(NaN);
  for (let row = 0; row < grid.latitude.length; row++) {
    const targetRow = Math.round((RAINFALL_BOUNDS.north - 0.05 - grid.latitude[row]) / 0.1);
    if (targetRow < 0 || targetRow >= rows) continue;
    for (let col = 0; col < grid.longitude.length; col++) {
      const targetCol = Math.round((grid.longitude[col] - RAINFALL_BOUNDS.west - 0.05) / 0.1);
      if (targetCol >= 0 && targetCol < cols) matrix[targetRow * cols + targetCol] = grid.values[row * grid.longitude.length + col];
    }
  }
  const url = renderRainfallMatrix(matrix, grid.accumulationHours);
  if (url) rendered.set(grid, url);
  return url;
}

export interface RainfallDisplay {
  url: string;
  observedAt: string;
  source: string;
  numeric: RainfallNumeric | null;
}

/** Paint a CDN image during API cold starts without holding local data up on storage. */
export async function loadRainfallDisplay(hours: RainfallAccumulationHours, display: (frame: RainfallDisplay) => void): Promise<void> {
  let displayed = false;
  let selectedAt = -Infinity;
  let selectedNumeric = false;
  const accept = (frame: RainfallDisplay) => {
    const observed = Date.parse(frame.observedAt);
    if (!Number.isFinite(observed) || observed > Date.now() + 300_000 || observed + 6 * 3_600_000 <= Date.now()) return;
    if (observed < selectedAt || (observed === selectedAt && selectedNumeric && !frame.numeric)) return;
    selectedAt = observed;
    selectedNumeric = !!frame.numeric;
    displayed = true;
    display(frame);
  };
  const published = fetchRainfallImage(hours).then(frame => accept({ ...frame, numeric: null })).catch(() => {});
  const numeric = await fetchRainfallNumeric(hours).catch(() => null);
  const observed = numeric ? Date.parse(numeric.observedAt) : NaN;
  if (numeric && observed >= selectedAt && observed <= Date.now() + 300_000 && observed + 6 * 3_600_000 > Date.now()) {
    let url: string | null = null;
    try { url = renderNumericRainfall(numeric); } catch { /* Keep the usable CDN frame on canvas failure. */ }
    if (url) accept({ url, observedAt: numeric.observedAt, source: numeric.source, numeric });
  }
  if (displayed) return;
  await published;
  if (!displayed) throw new Error('Rainfall unavailable');
}
