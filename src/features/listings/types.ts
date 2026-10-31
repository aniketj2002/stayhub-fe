import type { ListingAccess } from '../auth/permissions';
import type { Media } from '../media/api';

export interface Amenity {
  code: string;
  label: string;
  category: string;
}
export interface Policy {
  code: string;
  name: string;
  description: string;
  rules?: { min_hours_before: number; refund_pct: number; refunds_service_fee: boolean }[];
}
export interface Listing {
  id: string;
  status: string;
  live_version_id?: string;
  working_version_id?: string;
}
export interface ListingVersion {
  id: string;
  version_no: number;
  status: string;
  wizard_step: number;
  property_type?: string;
  title?: string;
  description?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  region?: string;
  country?: string;
  postal_code?: string;
  timezone: string;
  max_guests?: number;
  base_price_minor?: number;
  cleaning_fee_minor: number;
  currency: string;
  instant_book: boolean;
  check_in_time: string;
  check_out_time: string;
  house_rules?: string;
  cancellation_policy?: string;
  amenities: string[] | null;
  media_ids: string[] | null;
  photos: Media[] | null;
}
export interface ListingCheck {
  id: string;
  check_code: string;
  outcome: 'pass' | 'warn' | 'fail';
  detail?: string;
}
export interface HostListing {
  listing: Listing;
  working_version?: ListingVersion;
  live_version?: ListingVersion;
  check_results: ListingCheck[] | null;
  host_access: ListingAccess & { config?: Record<string, unknown> };
}
export interface HostSummary {
  id: string;
  title?: string;
  status: string;
  city?: string;
  country?: string;
  base_price_minor?: number;
  currency: string;
  cover_photo_url?: string;
  wizard_step: number;
  rating_avg?: number;
  review_count?: number;
  host_access: ListingAccess;
}
export interface SubmitResult {
  listing: Listing;
  version: ListingVersion;
  check_results: ListingCheck[];
  all_passed: boolean;
}
export type WorkingPatch = Partial<
  Omit<ListingVersion, 'id' | 'version_no' | 'status' | 'photos' | 'amenities' | 'media_ids'>
> & { amenities?: string[]; media_ids?: string[] };
export interface Night {
  night: string;
  status: 'available' | 'blocked' | 'booked';
  block_reason?: string;
}
export interface CalendarData {
  listing_id: string;
  start_date: string;
  end_date: string;
  nights: Night[];
}
export interface SearchCard {
  id: string;
  title: string;
  city: string;
  country: string;
  property_type: string;
  max_guests: number;
  instant_book: boolean;
  currency: string;
  nightly_price_minor: number;
  cover_photo_url: string | null;
  rating: number | null;
  stay_total_minor?: number;
  nights?: number;
}
export interface PublicListing {
  id: string;
  title: string;
  description: string;
  property_type: string;
  city: string;
  country: string;
  region?: string;
  timezone: string;
  max_guests: number;
  base_price_minor: number;
  cleaning_fee_minor: number;
  currency: string;
  instant_book: boolean;
  check_in_time: string;
  check_out_time: string;
  house_rules: string;
  photos: Media[] | null;
  amenities: Amenity[] | null;
  cancellation_policy: Policy;
  host: { id: string; full_name: string; avatar_url?: string; joined_at: string };
  rating: number | null;
  unavailable_dates: Night[] | null;
}
export interface StaySelection {
  check_in: string;
  check_out: string;
  guests: number;
}
export interface Quote {
  listing_id: string;
  listing_version_id: string;
  check_in: string;
  check_out: string;
  guests: number;
  currency: string;
  timezone: string;
  instant_book: boolean;
  breakdown: {
    nights: number;
    nightly_rate_minor: number;
    nightly_total_minor: number;
    cleaning_fee_minor: number;
    guest_fee_bps: number;
    guest_fee_minor: number;
    guest_total_minor: number;
    discount_minor?: number;
    discount_kind?: string;
    subtotal_minor?: number;
    night_count?: number;
  };
  cancellation_policy: Policy;
  refund_milestones:
    | {
        cutoff_at: string;
        refund_pct: number;
        refunds_service_fee: boolean;
        min_hours_before: number;
      }[]
    | null;
}
