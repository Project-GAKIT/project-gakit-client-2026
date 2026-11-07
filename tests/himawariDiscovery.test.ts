import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHimawariMetadata, selectAvailableStamps } from '@/lib/server/himawariDiscovery';

const url = 'https://source.test/latest_times.json';
const fresh = 20261107033000;
function setup() { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-07T04:00:00Z')); }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('CIRA discovery failure diagnostics', () => {
  it('backs off on transient server failures and succeeds without extra requests', async () => {
    setup();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(Response.json({ timestamps_int: [fresh] }));
    vi.stubGlobal('fetch', fetcher);
    const pending = fetchHimawariMetadata(url);
    await vi.advanceTimersByTimeAsync(999); expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(fetcher).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await pending).toEqual([fresh]); expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('bounds repeated transport timeouts and preserves their category and attempt count', async () => {
    setup(); const fetcher = vi.fn().mockRejectedValue(new DOMException('Request timed out', 'TimeoutError'));
    vi.stubGlobal('fetch', fetcher);
    const result = expect(fetchHimawariMetadata(url)).rejects.toMatchObject({ kind: 'timeout', details: { attempts: 3 } });
    await vi.advanceTimersByTimeAsync(3_000); await result;
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it.each([403, 404, 429])('does not hammer a source returning HTTP %i', async status => {
    setup(); const fetcher = vi.fn().mockResolvedValue(new Response('', { status }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchHimawariMetadata(url)).rejects.toMatchObject({ kind: 'http', details: { status, attempts: 1 } });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it('reports the actual stale scan and age instead of a generic outage', async () => {
    setup(); const fetcher = vi.fn().mockResolvedValue(Response.json({ timestamps_int: [20261107012000] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(fetchHimawariMetadata(url)).rejects.toMatchObject({ kind: 'stale', message: expect.stringContaining('160 minutes old'), details: { latestScan: '20261107012000', attempts: 1 } });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(selectAvailableStamps([20261107012000])).toEqual([]);
  });
  it.each(['not json', '{"timestamps_int":null}', '{"timestamps_int":[20260230010000]}'])('reports invalid metadata without logging its body', async body => {
    setup(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    await expect(fetchHimawariMetadata(url)).rejects.toMatchObject({ kind: 'invalid_metadata', details: { attempts: 1 } });
  });
});
