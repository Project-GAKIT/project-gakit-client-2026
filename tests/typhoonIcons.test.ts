import { afterEach, expect, it, vi } from 'vitest';
import { registerTyphoonIcons } from '@/lib/map/typhoonIcons';

afterEach(() => vi.unstubAllGlobals());
it('does not install images into a replaced or removed style', async () => {
  let current = true;
  const close = vi.fn();
  const map = { hasImage: vi.fn(() => false), loadImage: vi.fn(async () => ({ data: { close } })), addImage: vi.fn() };
  const loading = registerTyphoonIcons(map, () => current);
  current = false;
  await loading;
  expect(map.addImage).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledTimes(map.loadImage.mock.calls.length);
});
it('registers and releases downsampled bitmap resources', async () => {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 96, close })));
  const map = { hasImage: () => false, loadImage: async () => ({ data: { width: 600 } }), addImage: vi.fn() };
  await registerTyphoonIcons(map);
  expect(map.addImage.mock.calls.length).toBeGreaterThan(0);
  expect(close).toHaveBeenCalledTimes(map.addImage.mock.calls.length);
});
