import { describe, expect, it } from 'vitest';
import { isValidFloodDepthCm, validateObservationTime, validateSearchText } from '@/lib/validation/publicInputValidation';

describe('public search validation', () => {
  it('allows ordinary punctuation and SQL-shaped text as data', () => {
    expect(validateSearchText("St. Mary's Rd., 1-2", { minLength: 2 })).toBeNull();
    expect(validateSearchText("x' OR 1=1 --", { minLength: 2 })).toBeNull();
  });

  it('enforces the minimum, length cap, and control-character rule', () => {
    expect(validateSearchText('A', { minLength: 2 })).toBe('Enter at least 2 characters.');
    expect(validateSearchText('x'.repeat(121))).toBe('Search must be 120 characters or fewer.');
    expect(validateSearchText('Iligan\u0000City')).toBe('Search cannot contain control characters.');
  });
});

describe('public report input validation', () => {
  it('accepts only whole centimeter depths from 1 through 999', () => {
    expect(isValidFloodDepthCm('1')).toBe(true);
    expect(isValidFloodDepthCm('999')).toBe(true);
    expect(isValidFloodDepthCm('0')).toBe(false);
    expect(isValidFloodDepthCm('1000')).toBe(false);
    expect(isValidFloodDepthCm('1.5')).toBe(false);
    expect(isValidFloodDepthCm("1' OR 1=1")).toBe(false);
  });

  it('rejects invalid and too-far-ahead observation times', () => {
    const now = Date.parse('2026-11-10T00:00:00Z');
    expect(validateObservationTime('', now)).toBe('Enter the date and time observed.');
    expect(validateObservationTime('not-a-date', now)).toBe('Enter a valid date and time.');
    expect(validateObservationTime('2026-11-10T00:05:01Z', now)).toBe('Observation time cannot be more than 5 minutes in the future.');
    expect(validateObservationTime('2026-11-10T00:05:00Z', now)).toBeNull();
  });
});
