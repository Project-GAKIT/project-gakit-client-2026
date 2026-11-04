import { afterEach, describe, expect, it, vi } from 'vitest';
const manifest={schema:'himawari-publication-v2',generated_at:'2026-11-04T07:00:00Z',frames:[{stamp:'20261104065000',bytes:400000,sha256:'a'.repeat(64)}]};
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();vi.useRealTimers();vi.resetModules();});
async function reader(){vi.resetModules();vi.useFakeTimers();vi.setSystemTime(new Date('2026-11-04T07:00:00Z'));vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://project.supabase.co');return import('@/lib/server/publishedHimawari');}
describe('published satellite reader',()=>{
 it('returns completed public URLs using only the shared manifest',async()=>{
  const {publishedHimawari}=await reader();const fetcher=vi.fn<typeof fetch>(async()=>Response.json(manifest));vi.stubGlobal('fetch',fetcher);
  const result=await publishedHimawari();expect(result.frames).toEqual(['20261104065000']);
  expect(result.image_urls['20261104065000']).toBe('https://project.supabase.co/storage/v1/object/public/satellite-frames/himawari-v2/frames/20261104065000.webp');
  await publishedHimawari();expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toContain('/latest.json?t=');
 });
 it('rejects stale images instead of inventing a fresh observation time',async()=>{
  const {publishedHimawari}=await reader();vi.stubGlobal('fetch',vi.fn(async()=>Response.json(manifest)));
  await publishedHimawari();vi.setSystemTime(new Date('2026-11-04T10:00:00Z'));
  await expect(publishedHimawari()).rejects.toThrow('too old');
 });
 it('does not fall back to CIRA if shared storage fails',async()=>{
  const {publishedHimawari}=await reader();const f=vi.fn(async()=>new Response('outage',{status:503}));vi.stubGlobal('fetch',f);
  await expect(publishedHimawari()).rejects.toThrow('unavailable');expect(f).toHaveBeenCalledTimes(1);
 });
});
