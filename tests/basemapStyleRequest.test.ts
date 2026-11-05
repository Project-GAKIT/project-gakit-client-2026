import { afterEach, describe, expect, it, vi } from 'vitest';
import { BasemapStyleRequest } from '@/lib/map/basemapStyleRequest';

afterEach(() => vi.unstubAllGlobals());
const style = { version: 8, sources: {}, layers: [] };

describe('basemap style requests', () => {
  it('does not replace the working map when style loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const apply = vi.fn();
    const request = new BasemapStyleRequest();
    await expect(request.load('dark', apply)).rejects.toThrow('503');
    expect(apply).not.toHaveBeenCalled();
  });
  it('applies only the latest requested style when responses arrive out of order', async () => {
    const responses: Array<(value: unknown) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => responses.push(resolve))));
    const request = new BasemapStyleRequest();
    const stale = vi.fn(); const latest = vi.fn();
    const first = request.load('light', stale);
    const second = request.load('dark', latest);
    responses[1]({ ok: true, json: async () => style });
    await second;
    responses[0]({ ok: true, json: async () => style });
    await first;
    expect(stale).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith(style);
  });
  it('cancels pending work on disposal and can apply local satellite styles', async () => {
    const request = new BasemapStyleRequest(); const apply = vi.fn();
    await request.load('satellite', apply);
    expect(apply).toHaveBeenCalledOnce();
    let complete!: (value: unknown) => void;
    vi.stubGlobal('fetch', () => new Promise(resolve => { complete = resolve; }));
    const pending = request.load('dark', apply);
    request.cancel();
    complete({ ok: true, json: async () => style }); await pending;
    expect(apply).toHaveBeenCalledOnce();
  });
});
