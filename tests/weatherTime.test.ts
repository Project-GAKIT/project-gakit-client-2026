import { describe, expect, it } from 'vitest';
import { formatRainfallTime, weatherTimestamp } from '@/lib/map/weatherTime';

describe('rainfall observation time', () => {
  it.each(['2026-11-06T08:00:00Z', '2026-11-06T08:00:00+00:00',
    '2026-11-06T16:00:00+08:00', '2026-11-06T08:00:00'])('formats %s in PHT without adding a second zone', value => {
    expect(formatRainfallTime(value)).toMatch(/^as of 4:00\s?PM PHT$/);
    expect(Date.parse(weatherTimestamp(value)!)).toBe(Date.parse('2026-11-06T08:00:00Z'));
  });
  it.each([null, undefined, '', 'invalid', '2026-11-06T08:00:00+00:00Z'])('does not fabricate observation time for %s', value => {
    expect(weatherTimestamp(value)).toBeNull();
    expect(formatRainfallTime(value)).toBe('—');
  });
});
