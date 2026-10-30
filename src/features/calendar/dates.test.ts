import { describe, expect, it } from 'vitest';
import { addDays, dateRangeError, nightsInRange, shiftMonth } from './dates';
import { searchError, searchParams } from '../search/selection';

describe('date-only calendar ranges', () => {
  it('excludes checkout and stays stable across daylight saving boundaries', () => {
    expect(nightsInRange('2026-10-24', '2026-10-27')).toEqual([
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
    ]);
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftMonth('2026-12-01', 1)).toBe('2027-01-01');
    expect(shiftMonth('2027-01-01', -1)).toBe('2026-12-01');
  });
  it('rejects impossible, reversed, and oversized date ranges', () => {
    expect(dateRangeError('2026-02-30', '2026-03-03')).not.toBe('');
    expect(dateRangeError('2026-03-03', '2026-03-03')).not.toBe('');
    expect(dateRangeError('2026-01-01', '2028-01-01')).not.toBe('');
    expect(nightsInRange('2026-03-03', '2026-03-02')).toEqual([]);
  });
  it('requires paired dates and integer guests while preserving supported URL parameters', () => {
    expect(searchError(new URLSearchParams('check_in=2030-01-01'))).not.toBe('');
    expect(searchError(new URLSearchParams('guests=1.5'))).not.toBe('');
    expect(searchError(new URLSearchParams('country=Portugal'))).not.toBe('');
    expect(
      searchParams(new URLSearchParams('city=Lisbon&country=pt&offset=12&fake=true')).toString(),
    ).toBe('city=Lisbon&country=PT&offset=12&limit=12');
  });
});
