import type { Admin, AdminRole } from './types';

export type AdminPermission =
  | 'reservations.read'
  | 'reservations.cancel'
  | 'reservations.refund'
  | 'payouts.hold_release'
  | 'listings.review'
  | 'cases.handle'
  | 'cases.decide'
  | 'fees.propose'
  | 'fees.approve'
  | 'admins.manage'
  | 'audit.read';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  support_l1: ['reservations.read', 'audit.read', 'cases.handle'],
  support_l2: [
    'reservations.read',
    'audit.read',
    'reservations.cancel',
    'reservations.refund',
    'payouts.hold_release',
    'cases.handle',
    'cases.decide',
  ],
  trust_safety: [
    'reservations.read',
    'audit.read',
    'reservations.cancel',
    'listings.review',
    'cases.handle',
    'cases.decide',
  ],
  finance: [
    'reservations.read',
    'audit.read',
    'reservations.refund',
    'payouts.hold_release',
    'cases.decide',
    'fees.propose',
    'fees.approve',
  ],
  catalog_manager: ['reservations.read', 'audit.read', 'listings.review'],
  super_admin: [
    'reservations.read',
    'audit.read',
    'reservations.cancel',
    'reservations.refund',
    'payouts.hold_release',
    'listings.review',
    'cases.handle',
    'cases.decide',
    'fees.propose',
    'fees.approve',
    'admins.manage',
  ],
};

export function hasAdminPermission(
  adminOrRole: Admin | AdminRole | string | null | undefined,
  permission: AdminPermission,
): boolean {
  if (!adminOrRole) return false;
  const role = typeof adminOrRole === 'string' ? adminOrRole : adminOrRole.role;
  if (!role) return false;
  if (role === 'super_admin') return true;
  const permissions = ROLE_PERMISSIONS[role as AdminRole];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export { RequireAdminPermission } from './guards';
