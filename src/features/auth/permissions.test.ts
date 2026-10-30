import { describe, expect, it } from 'vitest';
import { hasListingPermission } from './permissions';

describe('per-listing capabilities', () => {
  it('requires membership and the specific co-host permission', () => {
    expect(hasListingPermission(null, 'can_manage_calendar')).toBe(false);
    expect(
      hasListingPermission({ role: 'cohost', can_manage_calendar: true }, 'can_manage_calendar'),
    ).toBe(true);
    expect(
      hasListingPermission({ role: 'cohost', can_manage_calendar: true }, 'can_view_insights'),
    ).toBe(false);
    expect(hasListingPermission({ role: 'owner' }, 'can_manage_listing')).toBe(true);
  });
});
