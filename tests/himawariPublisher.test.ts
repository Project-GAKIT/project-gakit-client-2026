import { beforeAll, describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { publishSatelliteFrames, type SatellitePublicationStore } from '@/lib/server/himawariPublisher';
import { parseSatelliteManifest, recentPublishedScans, satelliteObjectPath, type SatelliteManifest } from '@/lib/map/himawariPublication';
const now = Date.parse('2026-11-04T07:00:00Z');
const fresh = '20261104065000', older = '20261104064000', expired = '20261104030000';
let image: Buffer;
beforeAll(async () => { image = await sharp({ create: { width: 1800, height: 1180, channels: 4,
  background: { r: 100, g: 150, b: 200, alpha: 0.5 } } }).webp({ lossless: true }).toBuffer(); });
function png() { return image; }
const manifest = (stamps = [older]): SatelliteManifest => ({ schema: 'himawari-publication-v2',
  generated_at: '2026-11-04T06:55:00Z', frames: stamps.map(stamp => ({ stamp, bytes: 33, sha256: 'a'.repeat(64) })) });
function fake(previous: SatelliteManifest | null = manifest(), files = [older, expired]) {
  const events: string[] = [];
  const store: SatellitePublicationStore = {
    readManifest: vi.fn(async () => previous), listFrames: vi.fn(async () => files),
    readFrame: vi.fn(async () => png()),
    uploadFrame: vi.fn(async stamp => { events.push('upload:' + stamp); }),
    publish: vi.fn(async () => { events.push('publish'); }),
    removeFrames: vi.fn(async stamps => { events.push('delete:' + stamps.join(',')); }),
  }; return { store, events };
}
describe('satellite publication and retention', () => {
  it('uploads before publishing and deletes only after successful publication', async () => {
    const {store,events}=fake(); const render=vi.fn(async()=>png());
    const result=await publishSatelliteFrames(store,async()=>[fresh,older],render,now);
    expect(events).toEqual(['upload:'+fresh,'publish','delete:'+expired]);
    expect(render).toHaveBeenCalledExactlyOnceWith(fresh);
    expect(result).toMatchObject({published:2,rendered:1,deleted:1});
  });
  it('never deletes anything if publication fails',async()=>{
    const {store}=fake(); vi.mocked(store.publish).mockRejectedValue(new Error('storage outage'));
    await expect(publishSatelliteFrames(store,async()=>[fresh],async()=>png(),now)).rejects.toThrow('storage outage');
    expect(store.removeFrames).not.toHaveBeenCalled();
  });
  it('protects active images beyond retention through an upstream outage',async()=>{
    const {store}=fake(manifest([expired]),[expired,'20261104025000']);
    const result=await publishSatelliteFrames(store,async()=>{throw Error('CIRA outage');},async()=>png(),now);
    expect(result).toMatchObject({rendered:0,delayed:true,upstreamUnavailable:true});
    expect(store.removeFrames).toHaveBeenCalledExactlyOnceWith(['20261104025000']);
    expect(recentPublishedScans(vi.mocked(store.publish).mock.calls[0][0],now)).toEqual([]);
  });
  it('never publishes failed renders or images missing from storage',async()=>{
    const {store}=fake(manifest([older]),[]);
    await expect(publishSatelliteFrames(store,async()=>[fresh],async()=>{throw Error('render failed');},now)).rejects.toThrow('No completed');
    expect(store.publish).not.toHaveBeenCalled(); expect(store.removeFrames).not.toHaveBeenCalled();
  });
  it('reuses orphan uploads without rewriting immutable objects',async()=>{
    const {store}=fake(null,[fresh]);const render=vi.fn();
    await publishSatelliteFrames(store,async()=>[fresh],render,now);
    expect(render).not.toHaveBeenCalled();expect(store.uploadFrame).not.toHaveBeenCalled();expect(store.publish).toHaveBeenCalledOnce();
  });
  it('keeps unexpired unlisted files safe for existing readers',async()=>{
    const {store}=fake(manifest([older]),[older,'20261104063000']);
    await publishSatelliteFrames(store,async()=>[fresh],async()=>png(),now);
    expect(store.removeFrames).not.toHaveBeenCalled();
  });
  it('rejects bad images and changed paths or contracts',async()=>{
    const {store}=fake(null,[]);
    await expect(publishSatelliteFrames(store,async()=>[fresh],async()=>Buffer.from('bad'),now)).rejects.toThrow();
    expect(()=>satelliteObjectPath('../secret')).toThrow();
    expect(()=>parseSatelliteManifest({...manifest(),schema:'unknown'})).toThrow();
    expect(()=>parseSatelliteManifest(manifest(['20260230000000']))).toThrow();
  });
  it('bounds the active manifest to the newest six usable images',async()=>{
    const stamps=['20261104065000','20261104064000','20261104063000','20261104062000','20261104061000','20261104060000','20261104055000','20261104054000'];
    const {store}=fake(null,[]);await publishSatelliteFrames(store,async()=>stamps,async()=>png(),now);
    expect(vi.mocked(store.publish).mock.calls[0][0].frames.map(f=>f.stamp)).toEqual(stamps.slice(0,6).reverse());
  });
});
