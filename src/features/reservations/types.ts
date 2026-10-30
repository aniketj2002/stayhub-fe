import type { Policy } from '../listings/types';
export type ReservationStatus =
  | 'inquiry'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'reviewed'
  | 'declined'
  | 'cancelled_by_guest'
  | 'cancelled_by_host'
  | 'disputed';
export interface Reservation {
  id: string;
  code: string;
  listing_id: string;
  listing_version_id: string;
  guest_id: string;
  host_id: string;
  status: ReservationStatus;
  is_instant_book: boolean;
  check_in: string;
  check_out: string;
  check_in_at: string;
  check_out_at: string;
  timezone: string;
  guests: number;
  guest_message?: string;
  currency: string;
  nightly_total_minor: number;
  cleaning_fee_minor: number;
  guest_fee_bps: number;
  guest_fee_minor: number;
  guest_total_minor: number;
  host_fee_bps: number;
  host_fee_minor: number;
  host_net_minor: number;
  cancellation_policy: string;
  request_expires_at?: string;
  decline_reason?: string;
  cancel_reason?: string;
  created_at: string;
  checked_in_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}
export interface Payment {
  id: string;
  kind: 'charge' | 'refund';
  status: 'pending' | 'succeeded' | 'failed';
  amount_minor: number;
  currency: string;
  created_at: string;
  simulated_ref?: string;
  refund_pct?: number;
  failure_reason?: string;
}
export interface Payout {
  id: string;
  reservation_id: string;
  status: 'scheduled' | 'held' | 'released' | 'cancelled' | 'failed';
  gross_minor: number;
  host_fee_minor: number;
  net_minor: number;
  currency: string;
  release_at?: string;
  released_at?: string;
  held_reason?: string;
}
export interface ReservationDetail {
  reservation: Reservation;
  nights: number;
  listing: {
    id: string;
    title: string;
    property_type: string;
    city: string;
    country: string;
    address_line1: string;
    cover_photo_url?: string;
  };
  guest: { id: string; full_name: string; email: string };
  host: { id: string; full_name: string; email: string };
  payments: Payment[] | null;
  payout?: Payout;
  cancellation_policy: Policy;
}
export interface RefundPreview {
  reservation_id: string;
  code: string;
  status: ReservationStatus;
  evaluated_at: string;
  check_in_at: string;
  currency: string;
  guest_paid_minor: number;
  breakdown: {
    policy_code: string;
    hours_before_check_in: number;
    refund_pct: number;
    refunds_service_fee: boolean;
    refunded_accommodation_minor: number;
    refunded_guest_fee_minor: number;
    refund_amount_minor: number;
    non_refundable_minor: number;
    matched_rule: { min_hours_before: number; refund_pct: number; refunds_service_fee: boolean };
  };
}
export interface CreateBooking {
  listing_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_message: string;
  payment_method_token: string;
}
export interface Today {
  pending_requests: ReservationDetail[] | null;
  arriving_today: ReservationDetail[] | null;
  currently_hosting: ReservationDetail[] | null;
  checking_out_today: ReservationDetail[] | null;
  upcoming: ReservationDetail[] | null;
}
export interface Earnings {
  currency: string;
  paid_minor: number;
  upcoming_minor: number;
  held_minor: number;
  cancelled_minor: number;
  payouts:
    | {
        payout: Payout;
        reservation_code: string;
        listing_id: string;
        listing_title: string;
        check_in: string;
        check_out: string;
      }[]
    | null;
}
