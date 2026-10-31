import { describe, expect, it } from 'vitest';
import { hasAdminPermission, type AdminPermission } from './adminPermissions';
import type { Admin, AdminRole } from './types';

describe('Admin Permissions', () => {
  it('allows super_admin access to all permissions', () => {
    const superAdmin: Admin = {
      id: 'admin-1',
      email: 'admin@stayhub.dev',
      full_name: 'Super Admin',
      role: 'super_admin',
    };

    const allPermissions: AdminPermission[] = [
      'reservations.read',
      'reservations.cancel',
      'reservations.refund',
      'payouts.hold_release',
      'listings.review',
      'cases.handle',
      'cases.decide',
      'fees.propose',
      'fees.approve',
      'admins.manage',
      'audit.read',
    ];

    allPermissions.forEach((perm) => {
      expect(hasAdminPermission(superAdmin, perm)).toBe(true);
      expect(hasAdminPermission('super_admin', perm)).toBe(true);
    });
  });

  it('restricts support_l1 to read and triage permissions', () => {
    const l1Admin: Admin = {
      id: 'admin-2',
      email: 'l1@stayhub.dev',
      full_name: 'L1 Agent',
      role: 'support_l1',
    };

    expect(hasAdminPermission(l1Admin, 'reservations.read')).toBe(true);
    expect(hasAdminPermission(l1Admin, 'audit.read')).toBe(true);
    expect(hasAdminPermission(l1Admin, 'cases.handle')).toBe(true);

    expect(hasAdminPermission(l1Admin, 'reservations.cancel')).toBe(false);
    expect(hasAdminPermission(l1Admin, 'reservations.refund')).toBe(false);
    expect(hasAdminPermission(l1Admin, 'admins.manage')).toBe(false);
  });

  it('allows support_l2 to cancel reservations and issue refunds', () => {
    expect(hasAdminPermission('support_l2', 'reservations.cancel')).toBe(true);
    expect(hasAdminPermission('support_l2', 'reservations.refund')).toBe(true);
    expect(hasAdminPermission('support_l2', 'payouts.hold_release')).toBe(true);
    expect(hasAdminPermission('support_l2', 'cases.decide')).toBe(true);
    expect(hasAdminPermission('support_l2', 'admins.manage')).toBe(false);
  });

  it('allows finance to propose and approve fees', () => {
    expect(hasAdminPermission('finance', 'fees.propose')).toBe(true);
    expect(hasAdminPermission('finance', 'fees.approve')).toBe(true);
    expect(hasAdminPermission('finance', 'payouts.hold_release')).toBe(true);
    expect(hasAdminPermission('finance', 'listings.review')).toBe(false);
  });

  it('allows catalog_manager to review listings', () => {
    expect(hasAdminPermission('catalog_manager', 'listings.review')).toBe(true);
    expect(hasAdminPermission('catalog_manager', 'reservations.cancel')).toBe(false);
  });

  it('handles null, undefined, or unknown roles safely', () => {
    expect(hasAdminPermission(null, 'reservations.read')).toBe(false);
    expect(hasAdminPermission(undefined, 'reservations.read')).toBe(false);
    expect(hasAdminPermission({ id: '1', email: 'a@b.com', full_name: 'None' }, 'reservations.read')).toBe(false);
    expect(hasAdminPermission('unknown_role' as AdminRole, 'reservations.read')).toBe(false);
  });
});
