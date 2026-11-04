import { afterEach, describe, expect, it, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink, utimes, writeFile } from 'node:fs/promises';
import { readStoredFrame, storeFrame } from '@/lib/server/himawariFrameStore';

const stamp = 20991231235000;
const file = join(tmpdir(), 'gakit-himawari-v1', `${stamp}.png`);
const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
afterEach(async () => { await unlink(file).catch(() => {}); });

describe('persistent satellite cache', () => {
  it('survives a module reload and preserves the published PNG bytes', async () => {
    await storeFrame(stamp, png);
    vi.resetModules();
    const reloaded = await import('@/lib/server/himawariFrameStore');
    expect(await reloaded.readStoredFrame(stamp)).toEqual(png);
  });
  it('ignores expired or corrupt files so a fresh render can replace them', async () => {
    await storeFrame(stamp, png);
    const expired = new Date(Date.now() - 3 * 60 * 60_000);
    await utimes(file, expired, expired);
    expect(await readStoredFrame(stamp)).toBeNull();
    await writeFile(file, 'not a PNG');
    expect(await readStoredFrame(stamp)).toBeNull();
  });
  it('rejects keys that could escape the frame directory', async () => {
    expect(await readStoredFrame(Number.NaN)).toBeNull();
    await expect(storeFrame(Number.NaN, png)).resolves.toBeUndefined();
  });
});
