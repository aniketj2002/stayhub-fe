export type ListingPermission =
  | 'can_manage_listing'
  | 'can_manage_calendar'
  | 'can_manage_reservations'
  | 'can_message_guests'
  | 'can_view_insights';
export type ListingAccess = { role: 'owner' | 'cohost' } & Partial<
  Record<ListingPermission, boolean>
>;
export function hasListingPermission(
  access: ListingAccess | null | undefined,
  permission: ListingPermission,
) {
  return !!access && (access.role === 'owner' || access[permission] === true);
}
