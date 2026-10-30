import { describe, expect, it } from 'vitest';
import { formatMoney, formatStayDate, formatTimestamp } from './format';

describe('display conventions', () => {
  it('formats EUR minor units without treating cents as euros', () => {
    expect(formatMoney(11400)).toBe('€114.00');
    expect(formatMoney(0)).toBe('€0.00');
  });
  it('keeps a stay date on its original calendar day', () => {
    expect(formatStayDate('2026-10-30')).toBe('30 Oct 2026');
    expect(() => formatStayDate('2026-02-30')).toThrow('Invalid stay date');
    expect(() => formatStayDate('10/30/2026')).toThrow('Expected YYYY-MM-DD');
  });
  it('uses the requested timezone for reservation timestamps', () => {
    expect(formatTimestamp('2026-10-30T23:30:00Z', 'Asia/Tokyo')).toContain('31 Oct 2026');
  });
});
