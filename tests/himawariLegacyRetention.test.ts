import { describe, expect, it } from 'vitest';
import { expiredLegacySatellitePaths } from '@/lib/server/himawariLegacyRetention';
const now = Date.parse('2026-11-04T10:00:00Z');
const old = { schema: 'himawari-publication-v1', generated_at: '2026-11-04T07:00:00Z', frames: [{ stamp: '20261104065000' }] };
describe('PNG migration cleanup', () => {
  it('protects the old feed throughout the compatibility window', () => {
    expect(expiredLegacySatellitePaths({ ...old, generated_at: '2026-11-04T09:00:00Z' }, ['20261104065000.png'], now)).toEqual([]);
    expect(expiredLegacySatellitePaths({ ...old, frames: [{ stamp: '20261104093000' }] }, ['20261104065000.png'], now)).toEqual([]);
  });
  it('retires expired PNGs and their manifest, leaving unknown names untouched', () => {
    expect(expiredLegacySatellitePaths(old, ['20261104065000.png', '../outside.png', 'notes.json', '20260230000000.png'], now))
      .toEqual(['himawari-v1/frames/20261104065000.png', 'himawari-v1/latest.json']);
  });
  it('keeps the manifest if an extra managed file is still recent', () => {
    expect(expiredLegacySatellitePaths(old, ['20261104065000.png', '20261104093000.png'], now))
      .toEqual(['himawari-v1/frames/20261104065000.png']);
  });
  it.each([null, {}, { ...old, schema: 'unknown' }, { ...old, frames: [null] }])('refuses cleanup of an invalid manifest', value => {
    expect(expiredLegacySatellitePaths(value, ['20261104065000.png'], now)).toEqual([]);
  });
});
