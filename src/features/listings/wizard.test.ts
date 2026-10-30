import { describe, expect, it } from 'vitest';
import { toForm, toMinor, wizardPatch } from './wizard';
import { version } from '../../test/fixtures';

describe('listing draft serialization', () => {
  it('converts entered euro amounts to cents without silently rounding extra decimals', () => {
    expect(toMinor('0.29')).toBe(29);
    expect(toMinor('100.01')).toBe(10001);
    expect(toMinor('1.1')).toBe(110);
    for (const value of ['1.001', '-1', 'Infinity', '1e3', 'NaN', '9007199254740992'])
      expect(() => toMinor(value)).toThrow();
  });
  it('sends only the current step, preserving unsent steps and currency minor units', () => {
    const form = { ...toForm(version), price: '129.99', cleaning: '29.95' };
    expect(wizardPatch(form, 5, 6)).toEqual({
      wizard_step: 6,
      base_price_minor: 12999,
      cleaning_fee_minor: 2995,
      currency: 'EUR',
      instant_book: true,
    });
    expect(wizardPatch(form, 4, 5)).not.toHaveProperty('base_price_minor');
  });
  it('deduplicates attached photos and rejects fractional guest capacity', () => {
    const form = { ...toForm(version), media_ids: ['photo-a', 'photo-a', 'photo-b'] };
    expect(wizardPatch(form, 3, 4)).toMatchObject({ media_ids: ['photo-a', 'photo-b'] });
    expect(() => wizardPatch({ ...form, max_guests: '1.5' }, 2, 3)).toThrow();
  });
});
