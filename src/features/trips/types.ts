export interface TimelineDay {
  date: string;
  title: string;
  description: string;
  is_check_in: boolean;
  is_check_out: boolean;
}

export interface ReceiptPayment {
  id: string;
  type: 'charge' | 'refund' | string;
  amount_eur: number;
  amount_minor: number;
  status: string;
  created_at: string;
}

export interface TripItinerary {
  reservation_id: string;
  code: string;
  status: string;
  listing_id: string;
  listing_title: string;
  cover_photo_url?: string | null;
  address?: string | null;
  city: string;
  country: string;
  check_in_date: string;
  check_out_date: string;
  check_in_time: string;
  check_out_time: string;
  timezone: string;
  check_in_instant: string;
  check_out_instant: string;
  host_name: string;
  host_email: string;
  guests: number;
  nightly_total_minor: number;
  cleaning_fee_minor: number;
  discount_minor: number;
  guest_fee_minor: number;
  guest_total_minor: number;
  currency: string;
  timeline: TimelineDay[];
  receipts: ReceiptPayment[];
}

export interface CreateReservationAlterationInput {
  check_in?: string;
  check_out?: string;
  guests?: number;
}

export interface DeclineReservationAlterationInput {
  reason: string;
}

export interface ReservationAlteration {
  id: string;
  reservation_id: string;
  requested_by: string;
  current_check_in: string;
  current_check_out: string;
  new_check_in: string;
  new_check_out: string;
  delta_minor: number;
  currency: string;
  status: 'pending' | 'approved' | 'declined' | 'expired' | string;
  expires_at: string;
  decided_at?: string | null;
  decision_reason?: string | null;
  created_at: string;
}

export interface HostPendingAlteration extends ReservationAlteration {
  reservation_code: string;
  listing_title: string;
}

