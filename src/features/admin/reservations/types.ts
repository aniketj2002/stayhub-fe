export interface ReservationUserSummary {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
}

export interface ReservationListingSummary {
  id: string;
  title: string;
  city: string;
  country: string;
  cover_photo_url?: string;
}

export interface AdminReservationSummary {
  reservation: {
    id: string;
    code: string;
    listing_id: string;
    guest_id: string;
    host_id: string;
    status: string;
    check_in: string;
    check_out: string;
    guests?: number;
    adults_count?: number;
    children_count?: number;
    infants_count?: number;
    pets_count?: number;
    is_instant_book?: boolean;
    nightly_total_minor?: number;
    discount_minor?: number;
    cleaning_fee_minor?: number;
    guest_fee_bps?: number;
    guest_fee_minor?: number;
    guest_total_minor?: number;
    host_fee_bps?: number;
    host_fee_minor?: number;
    host_net_minor?: number;
    total_price_minor?: number;
    cancellation_policy?: string;
    currency: string;
    timezone?: string;
    checked_in_at?: string;
    completed_at?: string;
    cancellation_reason?: string;
    created_at: string;
    updated_at: string;
  };
  listing: ReservationListingSummary;
  guest: ReservationUserSummary;
  host: ReservationUserSummary;
}

export interface AdminReservationListResponse {
  total: number;
  reservations: AdminReservationSummary[];
}

export interface PaymentRecord {
  id: string;
  reservation_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  type?: string;
  kind?: string;
  provider?: string;
  provider_reference?: string;
  simulated_ref?: string;
  created_at: string;
}

export interface PayoutRecord {
  id: string;
  reservation_id: string;
  host_id: string;
  amount_minor?: number;
  net_minor?: number;
  gross_minor?: number;
  host_fee_minor?: number;
  currency: string;
  status: 'scheduled' | 'held' | 'processing' | 'paid' | 'failed' | 'released' | 'cancelled';
  scheduled_for?: string;
  release_at?: string;
  released_at?: string;
  hold_reason?: string;
  held_reason?: string;
  simulated_ref?: string;
  paid_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface LedgerEntry {
  id: string;
  reservation_id: string;
  account: string;
  direction: 'debit' | 'credit';
  amount_minor: number;
  currency: string;
  entry_type: string;
  description: string;
  created_at: string;
}

export interface TimelineEvent {
  id: number;
  occurred_at: string;
  actor_type: string;
  actor_id?: string;
  action: string;
  object_type: string;
  object_id: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  request_id?: string;
}

export interface AdminReservationDetail {
  reservation: AdminReservationSummary['reservation'];
  listing: ReservationListingSummary;
  guest: ReservationUserSummary;
  host: ReservationUserSummary;
  payments: PaymentRecord[];
  payout?: PayoutRecord | null;
  ledger_entries: LedgerEntry[];
  timeline: TimelineEvent[];
  refundable_minor: number;
}

export interface AdminReservationFilters {
  code?: string;
  guest?: string;
  host?: string;
  listing?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AdminCancelReservationInput {
  reason: string;
  refund_mode: 'policy' | 'full' | 'custom';
  amount_minor?: number;
}

export interface AdminRefundReservationInput {
  reason: string;
  amount_minor: number;
}

