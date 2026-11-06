import { afterEach, expect, it, vi } from 'vitest';
import { invalidateApiCache } from '@/lib/backend/apiCache';
import { fetchRainfallImage, renderRainfallMatrix } from '@/lib/map/rainfall';
import { loadRainfallDisplay } from '@/lib/map/rainfallNumeric';

vi.mock('@/lib/map/rainfall', async original => ({
  ...await original<typeof import('@/lib/map/rainfall')>(),
  fetchRainfallImage: vi.fn(), renderRainfallMatrix: vi.fn(() => 'data:numeric'),
}));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); invalidateApiCache(''); });
const published = { url: 'https://cdn.test/rain.webp', observedAt: new Date().toISOString(), source: 'JAXA' };
const numeric = () => new Response(JSON.stringify({ encoding: 'float32-le', ...published, accumulationHours: 1,
  latitude: [8.25, 8.15], longitude: [124.25, 124.35], values: btoa(String.fromCharCode(...new Uint8Array(16))) }));

it('displays the CDN image while the numeric API is still warming', async () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  vi.mocked(fetchRainfallImage).mockResolvedValue(published);
  const display = vi.fn();
  void loadRainfallDisplay(1, display);
  await vi.waitFor(() => expect(display).toHaveBeenCalledWith({ ...published, numeric: null }));
});
it('displays numeric data without waiting for a stalled CDN and rejects a late image downgrade', async () => {
  let resolve!: (value: typeof published) => void;
  vi.mocked(fetchRainfallImage).mockImplementation(() => new Promise(done => { resolve = done; }));
  vi.stubGlobal('fetch', vi.fn(async () => numeric()));
  const display = vi.fn();
  await loadRainfallDisplay(1, display);
  expect(display).toHaveBeenCalledOnce();
  expect(display.mock.calls[0][0].url).toBe('data:numeric');
  expect(display.mock.calls[0][0].numeric.values.length).toBe(4);
  resolve(published); await Promise.resolve();
  expect(display).toHaveBeenCalledOnce();
});
it('reports unavailability when both sources fail', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
  vi.mocked(fetchRainfallImage).mockRejectedValue(new Error('Storage unavailable'));
  await expect(loadRainfallDisplay(1, vi.fn())).rejects.toThrow('Rainfall unavailable');
});

it('keeps a newer CDN frame when the local API has older restored data', async () => {
  const older = { ...published, observedAt: new Date(Date.now() - 3600_000).toISOString() };
  vi.mocked(fetchRainfallImage).mockResolvedValue(published);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ encoding: 'float32-le', ...older, accumulationHours: 1,
    latitude: [8.25, 8.15], longitude: [124.25, 124.35], values: btoa(String.fromCharCode(...new Uint8Array(16))) }))));
  const display = vi.fn();
  await loadRainfallDisplay(1, display);
  expect(display).toHaveBeenCalledOnce();
  expect(display.mock.calls[0][0].url).toBe(published.url);
});
it('retains a usable CDN image if the local canvas cannot render', async () => {
  vi.mocked(fetchRainfallImage).mockResolvedValue(published);
  vi.mocked(renderRainfallMatrix).mockImplementationOnce(() => { throw new Error('Canvas unavailable'); });
  vi.stubGlobal('fetch', vi.fn(async () => numeric()));
  const display = vi.fn();
  await loadRainfallDisplay(1, display);
  expect(display.mock.calls[0][0].url).toBe(published.url);
});
it('never displays expired data from either source', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
  vi.mocked(fetchRainfallImage).mockResolvedValue({ ...published, observedAt: new Date(Date.now() - 7 * 3600_000).toISOString() });
  await expect(loadRainfallDisplay(1, vi.fn())).rejects.toThrow('Rainfall unavailable');
});
