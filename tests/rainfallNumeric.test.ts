import { expect, it } from 'vitest';
import { decodeRainfallNumeric, sampleRainfallNumeric } from '@/lib/map/rainfallNumeric';

const payload = () => {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  [0, 12.4, NaN, 0.04].forEach((v, i) => view.setFloat32(i * 4, v, true));
  return { encoding: 'float32-le', observedAt: '2026-11-06T03:00:00Z', accumulationHours: 1,
    source: 'JAXA', latitude: [8.25, 8.15], longitude: [124.25, 124.35],
    values: btoa(String.fromCharCode(...bytes)) };
};
it('samples the same native grid locally, including measured zero and missing cells', () => {
  const grid = decodeRainfallNumeric(payload());
  expect(sampleRainfallNumeric(grid, 124.23, 8.23)).toBe(0);
  expect(sampleRainfallNumeric(grid, 124.34, 8.23)).toBeCloseTo(12.4);
  expect(sampleRainfallNumeric(grid, 124.23, 8.13)).toBeNull();
  expect(sampleRainfallNumeric(grid, 124.34, 8.13)).toBeCloseTo(0.04);
  expect(sampleRainfallNumeric(grid, 125, 8)).toBeNull();
});
it('rejects malformed grids before sampling', () => {
  expect(() => decodeRainfallNumeric({ ...payload(), values: 'AAAA' })).toThrow();
  expect(() => decodeRainfallNumeric({ ...payload(), latitude: [8.25, 9] })).toThrow();
});

it('normalizes legacy UTC timestamps before comparing expiry in Manila', () => {
  expect(decodeRainfallNumeric({ ...payload(), observedAt: '2026-11-06T10:00:00' }).observedAt).toBe('2026-11-06T10:00:00Z');
});
