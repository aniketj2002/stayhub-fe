export interface CohostPermissions {
  can_manage_listing: boolean;
  can_manage_calendar: boolean;
  can_manage_reservations: boolean;
  can_message_guests: boolean;
  can_view_insights: boolean;
}

export interface CreateCohostInviteInput {
  email: string;
  permissions: CohostPermissions;
  payout_share_bps: number;
}

export interface CohostInvitation {
  id: string;
  listing_id: string;
  email: string;
  permissions: CohostPermissions;
  payout_share_bps: number;
  status: string;
  expires_at: string;
  created_at: string;
}

export interface CohostInviteResponseData {
  invitation: CohostInvitation;
  token?: string;
}

export interface UpdateCohostInput {
  permissions?: CohostPermissions;
  payout_share_bps?: number;
}

export interface CohostMember {
  user_id: string;
  full_name: string;
  email: string;
  role: 'owner' | 'cohost' | string;
  permissions: CohostPermissions;
  payout_share_bps: number;
  created_at: string;
}

export interface AcceptCohostInviteResponse {
  listing_id: string;
  status: string;
}

export interface CohostInvitationDetails {
  id: string;
  listing_id: string;
  listing_title: string;
  host_name: string;
  invited_email: string;
  permissions: CohostPermissions;
  payout_share_bps: number;
  status: string;
  expires_at: string;
}

