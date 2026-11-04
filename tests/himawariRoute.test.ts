import { beforeEach, describe, expect, it, vi } from 'vitest';
const backend=vi.hoisted(()=>({publishedHimawari:vi.fn(),getHimawariSliderPng:vi.fn()}));
vi.mock('@/lib/server/publishedHimawari',()=>backend);
vi.mock('@/lib/server/himawariSlider',()=>backend);
import { GET } from '@/app/api/himawari-proxy/route';
const ready={frames:['20261104065000'],image_urls:{'20261104065000':'https://storage.test/satellite-frames/himawari-v1/frames/20261104065000.png'}};
beforeEach(()=>{vi.resetAllMocks();backend.publishedHimawari.mockResolvedValue(ready);});
const request=(query:string)=>new Request(`https://gakit.test/api/himawari-proxy?${query}`);
describe('published satellite proxy',()=>{
  it('reads completed manifest without invoking renderer',async()=>{
    const result=await GET(request('manifest=1'));expect(await result.json()).toEqual(ready);
    expect(backend.getHimawariSliderPng).not.toHaveBeenCalled();
    expect(result.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=30');
    expect(result.headers.has('set-cookie')).toBe(false);
  });
  it.each(['manifest=1','time=20261104065000'])('returns retryable failures without on-demand rendering: %s',async query=>{
    backend.publishedHimawari.mockRejectedValue(Error('storage outage'));
    const result=await GET(request(query));expect(result.status).toBe(503);
    expect(result.headers.get('cache-control')).toBe('no-store');expect(result.headers.get('retry-after')).toBe('30');
    expect(backend.getHimawariSliderPng).not.toHaveBeenCalled();
  });
  it.each(['20261104065000','0650'])('redirects legacy clients to completed CDN images: %s',async time=>{
    const result=await GET(request('time='+time));expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe(ready.image_urls['20261104065000']);expect(result.headers.get('cache-control')).toBe('no-store');
  });
  it('keeps unpublished scans and invalid inputs uncached',async()=>{
    expect((await GET(request('time=20261104064000'))).status).toBe(404);expect((await GET(request('time=invalid'))).status).toBe(400);
  });
});
