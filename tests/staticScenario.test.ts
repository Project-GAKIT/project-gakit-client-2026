import { afterEach, expect, it, vi } from 'vitest';
import { fetchStaticScenario } from '@/lib/map/staticScenario';

afterEach(() => vi.unstubAllGlobals());
const data = { frames: [], bounds: [[0, 0], [1, 0], [1, 1], [0, 1]] };
it('loads the compact manifest without requesting the inline bundle', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  expect(await fetchStaticScenario('/data/scenarios/sendong.json', new AbortController().signal)).toEqual(data);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe('/data/scenario-assets/sendong.json');
});
it('supports deployments missing the generated manifest', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(Response.json(data));
  vi.stubGlobal('fetch', fetcher);
  await fetchStaticScenario('/data/scenarios/sendong.json', new AbortController().signal);
  expect(fetcher.mock.calls[1][0]).toBe('/data/scenarios/sendong.json');
});
it('surfaces server failures instead of downloading the large bundle', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(fetchStaticScenario('/data/scenarios/sendong.json', new AbortController().signal)).rejects.toThrow('503');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('passes cancellation through to fetch', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(options.signal.reason))));
  vi.stubGlobal('fetch', fetcher);
  const loading = fetchStaticScenario('/data/scenarios/sendong.json', controller.signal);
  controller.abort();
  await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
});
